const socket = io();

let localStream;
let remoteStream;

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

const constraints = {
    video: true,
    audio: true
};

navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = stream;
        socket.emit('broadcaster');
    })
    .catch(error => console.error(error));

socket.on('watcher', id => {
    const peerConnection = new RTCPeerConnection();
    remoteStream = new MediaStream();

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    peerConnection.ontrack = event => {
        event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
    };

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('candidate', id, event.candidate);
        }
    };

    socket.on('candidate', (id, candidate) => {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
            .catch(error => console.error(error));
    });

    peerConnection.createOffer()
        .then(sdp => peerConnection.setLocalDescription(sdp))
        .then(() => {
            socket.emit('offer', id, peerConnection.localDescription);
        })
        .catch(error => console.error(error));
});

socket.on('answer', (id, description) => {
    const peerConnection = new RTCPeerConnection();
    remoteStream = new MediaStream();

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    peerConnection.ontrack = event => {
        event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
    };

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('candidate', id, event.candidate);
        }
    };

    peerConnection.setRemoteDescription(description)
        .then(() => peerConnection.createAnswer())
        .then(sdp => peerConnection.setLocalDescription(sdp))
        .then(() => {
            socket.emit('answer', id, peerConnection.localDescription);
        })
        .catch(error => console.error(error));
});

socket.on('connect', () => {
    console.log('Connected to signaling server');
});

socket.on('broadcaster', () => {
    socket.emit('watcher');
});

socket.on('disconnect', () => {
    console.log('Disconnected from signaling server');
});

function selectTargetSocketId() {
    const select = document.getElementById('userList');
    const targetSocketId = select.options[select.selectedIndex].value;
    socket.emit('watcher', targetSocketId);
}

function stopRecording() {
    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');
    const stream = localVideo.srcObject;
    const tracks = stream.getTracks();

    tracks.forEach(track => track.stop());
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
}

function toggleMute() {
    const localVideo = document.getElementById('localVideo');
    localVideo.muted = !localVideo.muted;
}