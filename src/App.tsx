import { useState, useEffect, useCallback, useRef } from 'react';

import {
  createRoom,
  joinRoom,
  connectToRoom,
  disconnectFromRoom,
  updateSettings,
  addEventListener,
  removeEventListener,
  isConnected,
  type WebSocketMessageType
} from './lib/api-service';
import type { RoomData, WebSocketErrorData, RoomSettings } from './types';

import WelcomeScreen from './components/WelcomeScreen';
import CreateRoomScreen from './components/CreateRoomScreen';
import JoinRoomScreen from './components/JoinRoomScreen';
import RoomScreen from './components/RoomScreen';
import ErrorBanner from './components/ErrorBanner';
import LoadingOverlay from './components/LoadingOverlay';

type AppScreen = 'welcome' | 'create' | 'join' | 'room';

const App = () => {
  const [name, setName] = useState<string>('');
  const [roomKey, setRoomKey] = useState<string>('');
  const [screen, setScreen] = useState<AppScreen>('welcome');
  const [roomData, setRoomData] = useState<RoomData>({
    key: '',
    users: [],
    moderator: '',
    connectedUsers: {},
    settings: {
    }
  });
  const [isModeratorView, setIsModeratorView] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const didLoadName = useRef(false);
  const didCheckUrlParams = useRef(false);
  const didAttemptRestore = useRef(false);

  // Join room from URL parameters
  useEffect(() => {
    if (didCheckUrlParams.current) return;
    
    didCheckUrlParams.current = true;
    
    try {
      const url = new URL(window.location.href);
      const joinParam = url.searchParams.get('join');
      
      // Check if URL contains ?join=roomKey
      if (joinParam && joinParam.length > 0) {
        setRoomKey(joinParam.toUpperCase());
        setScreen('join');
        
        window.history.replaceState({}, document.title, '/');
      }
    } catch (err) {
      console.error('Failed to parse URL parameters', err);
    }
  }, []);

  // Auto-reconnect to last room on refresh
  useEffect(() => {
    if (didAttemptRestore.current) return;
    if (screen !== 'welcome') return;
    if (!name) return;
    didAttemptRestore.current = true;
    const savedRoomKey = localStorage.getItem('threatjam_roomKey');
    if (savedRoomKey) {
      setIsLoading(true);
      joinRoom(name, savedRoomKey)
        .then((joinedRoom) => {
          setRoomData(joinedRoom);
          setIsModeratorView(joinedRoom.moderator === name);
          setScreen('room');
        })
        .catch((err) => {
          const errorMessage = err instanceof Error ? err.message : 'Failed to reconnect to room';
          setError(errorMessage);
          localStorage.removeItem('threatjam_roomKey');
        })
        .finally(() => setIsLoading(false));
    }
  }, [name, screen]);

  const handleRoomUpdate = useCallback((updatedRoomData: RoomData) => {
    setRoomData(updatedRoomData);

    setIsModeratorView(updatedRoomData.moderator === name);

    setError('');
  }, [name]);

  // Connect to WebSocket when entering a room
  useEffect(() => {
    if (screen === 'room' && name && roomData.key) {
      connectToRoom(roomData.key, name, handleRoomUpdate);

      const errorHandler = (data: WebSocketErrorData) => {
        setError(data.error || 'Connection error');
      };

      const eventTypes: WebSocketMessageType[] = ['disconnected', 'error'];
      
      for (const type of eventTypes) {
        addEventListener(type, errorHandler);
      }

      return () => {
        disconnectFromRoom();
        for (const type of eventTypes) {
          removeEventListener(type, errorHandler);
        }
      };
    }
  }, [screen, name, roomData.key, handleRoomUpdate]);

  // Persist user name in localStorage (Combined Load & Save)
  useEffect(() => {
    if (!didLoadName.current) {
      const savedName = localStorage.getItem('threatjam_username');
      if (savedName) {
        setName(savedName);
      }
      didLoadName.current = true;
      return;
    }

    if (name === '' && !localStorage.getItem('threatjam_username')) {
      return;
    }

    const saveTimeout = setTimeout(() => {
      localStorage.setItem('threatjam_username', name);
    }, 500);

    return () => clearTimeout(saveTimeout);
  }, [name]);

  const handleCreateRoom = async () => {
    if (!name) return;

    setIsLoading(true);
    setError('');

    try {
      const newRoom = await createRoom(name);

      setRoomData(newRoom);
      localStorage.setItem('threatjam_roomKey', newRoom.key);
      setIsModeratorView(true);
      setScreen('room');
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create room';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!name || !roomKey) return;

    setIsLoading(true);
    setError('');

    try {
      const joinedRoom = await joinRoom(name, roomKey);

      setRoomData(joinedRoom);
      localStorage.setItem('threatjam_roomKey', joinedRoom.key);
      setIsModeratorView(joinedRoom.moderator === name);
      setScreen('room');
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to join room';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSettings = (settings: RoomSettings) => {
    if (!isModeratorView) return;

    try {
      updateSettings(settings);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to update settings';
      setError(errorMessage);
    }
  };

  const handleLeaveRoom = () => {
    disconnectFromRoom();
    localStorage.removeItem('threatjam_roomKey');
    setRoomData({
      key: '',
      users: [],
      moderator: '',
      connectedUsers: {},
      settings: {
      }
    });
    setScreen('welcome');
  };

  const clearError = () => setError('');

  return (
    <div className="min-h-screen bg-gray-50">
      {isLoading && <LoadingOverlay />}

      {error && screen !== 'room' && (
        <ErrorBanner message={error} onClose={clearError} />
      )}

      {screen === 'welcome' && (
        <WelcomeScreen
          onCreateRoom={() => setScreen('create')}
          onJoinRoom={() => setScreen('join')}
        />
      )}
      {screen === 'create' && (
        <CreateRoomScreen
          name={name}
          onNameChange={setName}
          onCreateRoom={handleCreateRoom}
          onBack={() => setScreen('welcome')}
          error={error}
          onClearError={clearError}
        />
      )}
      {screen === 'join' && (
        <JoinRoomScreen
          name={name}
          roomKey={roomKey}
          onNameChange={setName}
          onRoomKeyChange={setRoomKey}
          onJoinRoom={handleJoinRoom}
          onBack={() => setScreen('welcome')}
          error={error}
          onClearError={clearError}
        />
      )}
      {screen === 'room' && (
        <RoomScreen
          roomData={roomData}
          name={name}
          isModeratorView={isModeratorView}
          onUpdateSettings={handleUpdateSettings}
          onLeaveRoom={handleLeaveRoom}
          error={error}
          onClearError={clearError}
          isConnected={isConnected()}
        />
      )}
    </div>
  );
};

export default App;