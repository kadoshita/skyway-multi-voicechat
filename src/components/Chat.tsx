import React, { useState, useEffect } from 'react';
import { Grid } from '@material-ui/core';
import Peer, { RoomStream, MeshRoom } from 'skyway-js';
import { ROOM_NAME_STORE } from '../actions/index';
import User from './User';
import TextChat from './TextChat';

import store from '../store/index';
import deviceStore from '../store/device';

type ChatMessage = {
    user: string,
    message: string
};

const parseQueryParameter = (query: string): { [key: string]: string } => {
    let params: Array<string> = query.split('&');
    let paramObject: { [key: string]: string } = {};
    params.forEach(p => {
        let key = p.split('=')[0];
        let value = p.split('=')[1];
        paramObject[key] = value;
    });

    return paramObject;
}
const getMediaTrackConstraints = (): MediaTrackConstraints => {
    const { deviceId } = deviceStore.getState().inputDevice;
    if (deviceId !== '') {
        return {
            sampleSize: 16,
            echoCancellation: true,
            deviceId: deviceId
        };
    } else {
        return {
            sampleSize: 16,
            echoCancellation: true
        };
    }
};

const Chat = () => {
    const state = store.getState();
    const [myId, setMyId] = useState('');
    const [meshRoom, setMeshRoom] = useState<MeshRoom>();
    const [userStreams, setUserStreams] = useState<RoomStream[]>([]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const parameters = parseQueryParameter(window.location.search.replace('?', ''));
    const roomName = (state.roomname === '') ? parameters.room : state.roomname;
    if (roomName === '') {
        window.location.href = window.location.origin;
    } else if (!Object.keys(parameters).includes('room')) {
        window.history.replaceState('', '', `${window.location.origin}/chat?room=${roomName}`);
    } else {
        store.dispatch({ type: ROOM_NAME_STORE, name: roomName });
    }

    const pushChatMessage = (user: string, message: string) => {
        setChatMessages(prevChatMessages => {
            const newChatMessages = [...prevChatMessages];
            newChatMessages.push({
                user: user,
                message: message
            });
            return newChatMessages;
        });
    };

    const sendChatMessage = (msg: string) => {
        meshRoom?.send(msg);
        pushChatMessage(myId, msg);
    };
    useEffect(() => {
        const apiKey = process.env.REACT_APP_SKYWAY_API_KEY || '';
        const peer = new Peer({
            key: apiKey
        });
        peer.on('open', async id => {
            console.log(`Conenction established between SkyWay Server!! My ID is ${id}`);
            setMyId(id);
            const audioTrackConstraints = getMediaTrackConstraints()
            const localAudioStream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: audioTrackConstraints
            });
            const _meshRoom = peer.joinRoom(roomName, {
                mode: 'mesh',
                stream: localAudioStream
            });
            _meshRoom.on('open', () => {
                console.log(`Join room ${roomName}`);
            });

            _meshRoom.on('stream', stream => {
                console.log(`User ${stream.peerId} streaming start`);
                const _userStreams = [...userStreams];
                _userStreams.push(stream);
                setUserStreams(_userStreams);
            });
            _meshRoom.on('peerLeave', peerId => {
                console.log(`User ${peerId} leave`);
                const _userStreams = [...userStreams];
                const leavePeerStreamIndex = _userStreams.findIndex(s => s.peerId === peerId);
                _userStreams.splice(leavePeerStreamIndex, 1);
                setUserStreams(_userStreams);
            });
            _meshRoom.on('data', data => {
                pushChatMessage(data.src, data.data);
            });

            setMeshRoom(_meshRoom as MeshRoom);
        });

        return () => {
            peer.destroy();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomName]);
    return (
        <Grid container style={{ height: '100%' }}>
            <Grid item xs={12} style={{ height: '5%' }}>
                <p style={{ margin: '0px' }}>ルーム: {roomName}</p>
            </Grid>
            <Grid item xs={4} style={{ height: '95%' }}>
                <Grid container style={{ height: '100%' }}>
                    <Grid item xs={12} style={{ height: '5%' }}>
                        <p style={{ fontSize: '130%', margin: '0px' }}>{(state.username !== '') ? state.username : myId}</p>
                    </Grid>
                    <Grid item xs={4} style={{ height: '20%' }}></Grid>
                    <Grid item xs={4} style={{ height: '20%' }}>
                        <img src='user.png' alt="user icon" style={{ width: 'auto', height: '80%' }}></img>
                    </Grid>
                    <Grid item xs={4} style={{ height: '20%' }}></Grid>
                    <Grid item xs={12} style={{ height: '75%' }}>
                        <TextChat chatMessages={chatMessages} sendChatMessage={sendChatMessage}></TextChat>
                    </Grid>
                </Grid>
            </Grid>
            <Grid item xs={8} style={{ height: '95%' }}>
                <Grid container>
                    {userStreams.map((u, i) => <Grid item xs={2} key={i}><User stream={u}></User></Grid>)}
                </Grid>
            </Grid>
        </Grid>
    )
};

export default Chat;