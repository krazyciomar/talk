const socket = io();
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
let targetSocketId;
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const peerConnection = new RTCPeerConnection(configuration);

// Handle the creation of Offer
async function createOffer(target) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', offer, target);
}

// Handle ICE Candidate events
peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
        socket.emit('ice-candidate', event.candidate, targetSocketId);
    }
};

// Set up the video streams
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
.then((stream) => {
    localVideo.srcObject = stream;
    stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));
})
.catch((error) => console.error(error));

// Listen for the offer
socket.on('offer', async (offer, id) => {
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', answer, id);
});

// Listen for answer
socket.on('answer', async (answer) => {
    await peerConnection.setRemoteDescription(answer);
});

// Listen for ICE Candidate events
socket.on('ice-candidate', async (candidate) => {
    await peerConnection.addIceCandidate(candidate);
});

// Set remote stream
peerConnection.ontrack = (event) => {
    if (remoteVideo.srcObject !== event.streams[0]) {
        remoteVideo.srcObject = event.streams[0];
    }
};

// Update user list
socket.on('update-user-list', ({ users }) => {
    updateUserList(users);
});

function updateUserList(socketIds) {
    const list = document.getElementById('userList');
    list.innerHTML = '';
    
    socketIds.forEach(id => {
        if (socket.id !== id) {
            const item = document.createElement('option');
            item.textContent = id;
            list.appendChild(item);
        }
    });
}

function selectTargetSocketId() {
    const list = document.getElementById('userList');
    targetSocketId = list.value;
    createOffer(targetSocketId);
}
