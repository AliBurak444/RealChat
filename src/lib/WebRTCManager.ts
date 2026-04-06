import { db } from './firebase';
import { collection, doc, setDoc, onSnapshot, addDoc, deleteDoc, getDoc, getDocs, query, where } from 'firebase/firestore';

export class WebRTCManager {
  private roomId: string;
  private userId: string;
  private isHost: boolean;
  private localStreams: MediaStream[] = [];
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private onTrackCallback: ((stream: MediaStream, peerId: string) => void) | null = null;
  private unsubs: (() => void)[] = [];

  constructor(roomId: string, userId: string, isHost: boolean) {
    this.roomId = roomId;
    this.userId = userId;
    this.isHost = isHost;
  }

  addLocalStream(stream: MediaStream) {
    this.localStreams.push(stream);
    // Add to existing connections
    this.peerConnections.forEach(pc => {
      stream.getTracks().forEach(track => {
        // Check if track already added
        const senders = pc.getSenders();
        const exists = senders.some(s => s.track === track);
        if (!exists) {
          pc.addTrack(track, stream);
        }
      });
    });
  }

  onTrack(callback: (stream: MediaStream, peerId: string) => void) {
    this.onTrackCallback = callback;
  }

  async start() {
    if (this.isHost) {
      await this.setupHost();
    } else {
      await this.setupGuest();
    }
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    this.localStreams.forEach(stream => {
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
    });

    pc.ontrack = (event) => {
      if (this.onTrackCallback && event.streams[0]) {
        this.onTrackCallback(event.streams[0], peerId);
      }
    };

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        const signalsRef = collection(db, `rooms/${this.roomId}/liveSession/session/peers/${peerId}/signals`);
        await addDoc(signalsRef, {
          type: 'candidate',
          candidate: event.candidate.toJSON(),
          sender: this.userId,
          timestamp: Date.now()
        });
      }
    };

    this.peerConnections.set(peerId, pc);
    return pc;
  }

  private async setupHost() {
    await this.setupMesh();
  }

  private async setupGuest() {
    await this.setupMesh();
  }

  private async setupMesh() {
    const peerId = this.userId;
    const peerRef = doc(db, `rooms/${this.roomId}/liveSession/session/peers/${peerId}`);
    await setDoc(peerRef, { joinedAt: Date.now() });

    const peersRef = collection(db, `rooms/${this.roomId}/liveSession/session/peers`);
    
    // Listen for new peers joining
    const unsubPeers = onSnapshot(peersRef, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const remotePeerId = change.doc.id;
          if (remotePeerId === this.userId) return; // Ignore self

          // To avoid duplicate connections, only the peer with the lexicographically smaller ID initiates the offer
          const isInitiator = this.userId < remotePeerId;
          
          if (!this.peerConnections.has(remotePeerId)) {
            const pc = this.createPeerConnection(remotePeerId);
            
            // Listen for signals from this remote peer
            const signalsRef = collection(db, `rooms/${this.roomId}/liveSession/session/peers/${this.userId}/signals`);
            const q = query(signalsRef, where('sender', '==', remotePeerId));
            
            const unsubSignals = onSnapshot(q, async (sigSnap) => {
              sigSnap.docChanges().forEach(async (sigChange) => {
                if (sigChange.type === 'added') {
                  const data = sigChange.doc.data();
                  if (data.type === 'offer') {
                    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    
                    await addDoc(collection(db, `rooms/${this.roomId}/liveSession/session/peers/${remotePeerId}/signals`), {
                      type: 'answer',
                      answer: answer,
                      sender: this.userId,
                      timestamp: Date.now()
                    });
                  } else if (data.type === 'answer') {
                    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                  } else if (data.type === 'candidate') {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                  }
                }
              });
            });
            this.unsubs.push(unsubSignals);

            if (isInitiator) {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              
              await addDoc(collection(db, `rooms/${this.roomId}/liveSession/session/peers/${remotePeerId}/signals`), {
                type: 'offer',
                offer: offer,
                sender: this.userId,
                timestamp: Date.now()
              });
            }
          }
        }
      });
    });
    this.unsubs.push(unsubPeers);
  }

  stop() {
    this.unsubs.forEach(unsub => unsub());
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
  }
}
