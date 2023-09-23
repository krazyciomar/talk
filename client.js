const socket = io();
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const peerConnections = {};
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
let localStream;
let isMuted = false;
let mediaRecorder;
let recordedChunks = [];
let mimeType;
let fileExtension;

// Offer/Answer and ICE Candidate handling
function selectTargetSocketId() {
    const userList = document.getElementById('userList');
    const selectedSocketId = userList.options[userList.selectedIndex].value;
    if (selectedSocketId !== socket.id) {
        const peerConnection = new RTCPeerConnection(configuration);
        peerConnections[selectedSocketId] = peerConnection;
        setupPeerConnection(peerConnection);
        peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .then(() => {
                socket.emit('send-offer', selectedSocketId, peerConnection.localDescription);
            });
    } else {
        alert('You cannot call yourself!');
    }
}

socket.on('receive-offer', (offererSocketId, offer) => {
    const peerConnection = new RTCPeerConnection(configuration);
    peerConnections[offererSocketId] = peerConnection;
    setupPeerConnection(peerConnection);
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => peerConnection.createAnswer())
        .then(answer => peerConnection.setLocalDescription(answer))
        .then(() => {
            socket.emit('send-answer', offererSocketId, peerConnection.localDescription);
        });
});

socket.on('receive-answer', (answererSocketId, answer) => {
    const peerConnection = peerConnections[answererSocketId];
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('receive-ice-candidate', (senderSocketId, iceCandidate) => {
    const peerConnection = peerConnections[senderSocketId];
    peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate));
});

// WebRTC Video streams
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then((stream) => {
        localStream = stream;
        localVideo.srcObject = stream;
        stream.getTracks().forEach((track) => {
            for (let peerConnection of Object.values(peerConnections)) {
                peerConnection.addTrack(track, stream);
            }
        });

        mimeType = 'video/webm; codecs="vp8, opus"';
        fileExtension = 'webm';
        mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        document.getElementById('muteButton').addEventListener('click', () => {
            isMuted = !isMuted;
            localStream.getTracks().forEach((track) => {
                track.enabled = !isMuted;
            });
        });

        document.getElementById('hangupButton').addEventListener('click', () => {
            mediaRecorder.stop();
            for (let peerConnection of Object.values(peerConnections)) {
                peerConnection.close();
            }
            peerConnections = {};

            // Construct a Blob from the recorded media chunks
            const recordedBlob = new Blob(recordedChunks, { type: mimeType });

            // Create a form to send the Blob to the server
            const formData = new FormData();
            formData.append('video', recordedBlob, `recorded.${fileExtension}`);

            // Send the Blob to the server
            fetch('/upload', {
                method: 'POST',
                body: formData,
            }).then(() => {
                recordedChunks = [];  // Clear the recorded media chunks
            });
        });

    })
    .catch((error) => console.error(error));

function setupPeerConnection(peerConnection) {
    peerConnection.onicecandidate = function(event) {
        if (event.candidate) {
            for (let targetSocketId in peerConnections) {
                if (peerConnections[targetSocketId] === peerConnection) {
                    socket.emit('send-ice-candidate', targetSocketId, event.candidate);
                }
            }
        }
    };

    peerConnection.ontrack = function(event) {
        remoteVideo.srcObject = event.streams[0];
    };
}
