const socket = io();
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
let targetSocketId;
let mediaRecorder;
let recordedChunks = [];
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const peerConnection = new RTCPeerConnection(configuration);

// Offer/Answer and ICE Candidate handling
function selectTargetSocketId() {
    targetSocketId = document.getElementById('userList').value;
    peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
            socket.emit('send-offer', targetSocketId, peerConnection.localDescription);
        });
}

socket.on('receive-offer', (offererSocketId, offer) => {
    targetSocketId = offererSocketId;
    const remoteOffer = new RTCSessionDescription(offer);
    peerConnection.setRemoteDescription(remoteOffer).then(() => {
        return peerConnection.createAnswer();
    }).then(answer => {
        return peerConnection.setLocalDescription(answer);
    }).then(() => {
        socket.emit('send-answer', targetSocketId, peerConnection.localDescription);
    });
});

socket.on('receive-answer', (answer) => {
    const remoteAnswer = new RTCSessionDescription(answer);
    peerConnection.setRemoteDescription(remoteAnswer);
});

socket.on('receive-ice-candidate', (iceCandidate) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate));
});

// WebRTC Video streams
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
.then((stream) => {
    localVideo.srcObject = stream;
    stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

    // Check if H.264 codec is supported and initialize MediaRecorder
    let fileExtension;
    let mimeType;
    if (MediaRecorder.isTypeSupported('video/webm; codecs="H264"')) {
        mimeType = 'video/mp4';
        fileExtension = '.mp4';
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs="H264"' });
    } else {
        console.warn('H264 codec is not supported, falling back to default codec');
        mimeType = 'video/webm';
        fileExtension = '.webm';
        mediaRecorder = new MediaRecorder(stream);
    }

    mediaRecorder.ondataavailable = function(event) {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = async function() {
        const blob = new Blob(recordedChunks, {
            type: mimeType
        });
        await uploadVideo(blob, fileExtension);
    };

    // Start recording
    mediaRecorder.start();
})
.catch((error) => console.error(error));

// Functions to stop recording and upload the video
function stopRecording() {
    mediaRecorder.stop();
}

async function uploadVideo(blob, extension) {
    const formData = new FormData();
    formData.append('video', blob, `recorded${extension}`);

    await fetch('/upload', {
        method: 'POST',
        body: formData
    });
}

// Updating the user list for WebRTC communication
socket.on('user-connected', (data) => {
    // Update the user list when a user connects
    const userList = document.getElementById('userList');
    const option = document.createElement('option');
    option.value = data.socketId;
    option.textContent = data.socketId;
    userList.appendChild(option);
});

socket.on('user-disconnected', (data) => {
    // Update the user list when a user disconnects
    const userList = document.getElementById('userList');
    const option = Array.from(userList.options).find(option => option.value === data.socketId);
    if (option) {
        userList.removeChild(option);
    }
});

peerConnection.onicecandidate = function(event) {
    if (event.candidate) {
        socket.emit('send-ice-candidate', targetSocketId, event.candidate.toJSON());
    }
};

peerConnection.ontrack = function(event) {
    remoteVideo.srcObject = event.streams[0];
};

    peerConnection.ontrack = function(event) {
        remoteVideo.srcObject = event.streams[0];
    };
}
