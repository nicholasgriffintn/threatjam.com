import { type FC, useState, useEffect } from 'react';
import { encode } from 'plantuml-encoder';

import type { RoomData } from '../types';
import ConnectionStatus from './ConnectionStatus';
import ErrorBanner from './ErrorBanner';
import SettingsModal from './SettingsModal';
import ShareRoomModal from './ShareRoomModal';
import DiagramEditor from './DiagramEditor';

interface RoomScreenProps {
  roomData: RoomData;
  name: string;
  isModeratorView: boolean;
  onUpdateSettings: (settings: RoomData['settings']) => void;
  error: string;
  onClearError: () => void;
  isConnected: boolean;
  onLeaveRoom: () => void;
}

const RoomScreen: FC<RoomScreenProps> = ({
  roomData,
  name,
  isModeratorView,
  onUpdateSettings,
  error,
  onClearError,
  isConnected,
  onLeaveRoom,
}) => {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'code' | 'visual'>('visual');

  const defaultDiagramCode = `
    Person(1, "Label", "Optional Description")
    Container(2, "Label", "Technology", "Optional Description")
    System(3, "Label", "Optional Description")

    Rel(1, 2, "Label", "Optional Technology")
  `

  const [localDiagramCode, setLocalDiagramCode] = useState(
    roomData.settings.diagramCode || defaultDiagramCode
  );

  useEffect(() => {
    setLocalDiagramCode(roomData.settings.diagramCode || defaultDiagramCode);
  }, [roomData.settings.diagramCode]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (localDiagramCode !== (roomData.settings.diagramCode || '')) {
        onUpdateSettings({ diagramCode: localDiagramCode });
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [localDiagramCode, roomData.settings.diagramCode, onUpdateSettings]);

  const diagramUrl = localDiagramCode
    ? `https://www.plantuml.com/plantuml/svg/${encode(localDiagramCode)}`
    : '';

  useEffect(() => {
    console.log('Room settings updated:', roomData.settings);
  }, [roomData.settings]);

  return (
    <div className="flex flex-col h-screen">
      {error && <ErrorBanner message={error} onClose={onClearError} />}
      
      <header className="p-4 bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 md:space-x-4">
            <h1 className="text-lg md:text-xl font-bold">ThreatJam</h1>
            <div className="flex items-stretch h-7">
              <div className="px-2 md:px-3 py-1 text-xs md:text-sm bg-teal-800 rounded-l-md truncate max-w-[80px] md:max-w-none flex items-center">
                {roomData.key}
              </div>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(true)}
                className="px-2 py-1 bg-teal-700 hover:bg-teal-800 rounded-r-md border-l border-teal-600 flex items-center"
                title="Share Room"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <title>Share Room</title>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              onClick={onLeaveRoom}
              className="text-xs md:text-sm px-2 md:px-3 py-1 bg-teal-700 hover:bg-teal-800 rounded-md transition-colors"
              title="Leave Room"
            >
              Leave Room
            </button>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            <ConnectionStatus isConnected={isConnected} />
            <div className="hidden sm:block text-xs md:text-sm px-2 md:px-3 py-1 bg-teal-800 rounded-md">
              {isModeratorView ? 'Moderator' : 'Team Member'}
            </div>
            {isModeratorView && (
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(true)}
                className="p-1 md:p-1.5 rounded-full bg-teal-800 hover:bg-teal-900 transition-colors"
                title="Room Settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <title>Room Settings</title>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[20%_80%] flex-1 h-full">
        <div className="p-4 bg-gray-100 border-b md:border-b-0 md:border-r overflow-y-auto">
          <h2 className="mb-4 text-lg font-medium">Participants ({roomData.users.length})</h2>
          <ul className="space-y-2">
            {roomData.users.map((user: string) => (
              <li
                key={user}
                className="flex items-center justify-between p-2 bg-white rounded-md shadow-sm transition-all hover:shadow-md"
              >
                <div className="flex items-center space-x-2">
                  <span className={`${user === name ? 'font-medium' : ''}`}>
                    {user}
                    {user === roomData.moderator && (
                      <span className="ml-1 text-xs text-teal-600">(Mod)</span>
                    )}
                    {user === name && (
                      <span className="ml-1 text-xs text-gray-500">(You)</span>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col p-4 md:p-6 overflow-y-auto space-y-8">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Diagram Editor</h2>
            <div className="flex border rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => setEditorMode('visual')}
                className={`px-3 py-1 text-sm ${
                  editorMode === 'visual'
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Visual Editor
              </button>
              <button
                type="button"
                onClick={() => setEditorMode('code')}
                className={`px-3 py-1 text-sm ${
                  editorMode === 'code'
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Code Editor
              </button>
            </div>
          </div>

          <div className="flex-1">
            {editorMode === 'visual' ? (
              <div className="border rounded-md p-4 bg-white">
                <DiagramEditor
                  diagramCode={localDiagramCode}
                  onChange={setLocalDiagramCode}
                />
              </div>
            ) : (
              <textarea
                value={localDiagramCode}
                onChange={(e) => setLocalDiagramCode(e.target.value)}
                rows={12}
                className="w-full font-mono text-sm border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2"
              />
            )}
          </div>

          <div>
            <h2 className="mb-4 text-xl font-semibold">Live Preview</h2>
            {diagramUrl ? (
              <img
                src={diagramUrl}
                alt="C4 Diagram Preview"
                className="w-full border rounded-md shadow-sm"
              />
            ) : (
              <p className="text-gray-500">
                No diagram loaded. Use the visual editor or paste PlantUML code to see preview.
              </p>
            )}
          </div>
        </div>
      </div>

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={roomData.settings}
        onSaveSettings={onUpdateSettings}
      />

      <ShareRoomModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        roomKey={roomData.key}
      />
    </div>
  );
};

export default RoomScreen;