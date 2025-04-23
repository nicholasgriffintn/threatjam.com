import { useState, useEffect, useRef, useCallback } from 'react';
import type { FC } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

interface DiagramEditorProps {
  diagramCode: string;
  onChange: (code: string) => void;
}

// Define C4 element types
type ElementType = 'Person' | 'Container' | 'System' | 'Relationship';
type ElementData = {
  id: string;
  type: ElementType;
  label: string;
  description: string;
  technology?: string;
  x: number;
  y: number;
};

type RelationshipData = {
  id: string;
  from: string;
  to: string;
  label: string;
  technology?: string;
};

interface DragItem {
  id: string;
  type: string;
}

const DiagramEditor: FC<DiagramEditorProps> = ({ diagramCode, onChange }) => {
  const [elements, setElements] = useState<ElementData[]>([]);
  const [relationships, setRelationships] = useState<RelationshipData[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [relationshipMode, setRelationshipMode] = useState<boolean>(false);
  const [relationshipStart, setRelationshipStart] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [nextId, setNextId] = useState(1);
  
  // Add canvas panning and zooming
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [elementPositions, setElementPositions] = useState<Record<string, { x: number, y: number }>>({});

  // Track parsed element positions
  const positionMapRef = useRef<Record<string, { x: number, y: number }>>({});

  // Parse PlantUML code to elements and relationships
  useEffect(() => {
    if (!diagramCode) return;

    const parsedElements: ElementData[] = [];
    const parsedRelationships: RelationshipData[] = [];
    let maxId = 0;
    
    // Keep existing positions if possible
    const existingPositions = { ...positionMapRef.current };
    const newPositions: Record<string, { x: number, y: number }> = {};

    // Simple regex parsing for C4 elements
    const personRegex = /Person\((\w+),\s*"([^"]+)"(?:,\s*"([^"]+)")?\)/g;
    const containerRegex = /Container\((\w+),\s*"([^"]+)"(?:,\s*"([^"]+)")?(?:,\s*"([^"]+)")?\)/g;
    const systemRegex = /System\((\w+),\s*"([^"]+)"(?:,\s*"([^"]+)")?\)/g;
    const relationshipRegex = /Rel\((\w+),\s*(\w+),\s*"([^"]+)"(?:,\s*"([^"]+)")?\)/g;

    // Parse Person elements
    let match: RegExpExecArray | null;
    const tempDiagramCode = diagramCode;
    
    const parseElements = (regex: RegExp, type: ElementType) => {
      let match: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
      while ((match = regex.exec(tempDiagramCode)) !== null) {
        const id = match[1];
        const numericId = Number.parseInt(id);
        if (!Number.isNaN(numericId) && numericId > maxId) {
          maxId = numericId;
        }
        
        // Use existing position or generate new one with spacing
        let position: { x: number, y: number };
        if (existingPositions[id]) {
          position = existingPositions[id];
        } else {
          const countExisting = parsedElements.length;
          const col = countExisting % 3;
          const row = Math.floor(countExisting / 3);
          position = {
            x: 50 + col * 180,
            y: 50 + row * 120
          };
        }
        
        newPositions[id] = position;
        
        const newElement: ElementData = {
          id,
          type,
          label: match[2],
          description: '',
          x: position.x,
          y: position.y
        };
        
        if (type === 'Person') {
          newElement.description = match[3] || '';
        } else if (type === 'Container') {
          newElement.technology = match[3] || '';
          newElement.description = match[4] || '';
        } else if (type === 'System') {
          newElement.description = match[3] || '';
        }
        
        parsedElements.push(newElement);
      }
    };
    
    // Parse all elements while preserving positions
    parseElements(personRegex, 'Person');
    parseElements(containerRegex, 'Container');
    parseElements(systemRegex, 'System');
    
    // Parse Relationships
    // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
            while ((match = relationshipRegex.exec(tempDiagramCode)) !== null) {
      parsedRelationships.push({
        id: `rel_${match[1]}_${match[2]}`,
        from: match[1],
        to: match[2],
        label: match[3],
        technology: match[4] || ''
      });
    }

    setElements(parsedElements);
    setRelationships(parsedRelationships);
    setNextId(maxId + 1);
    positionMapRef.current = newPositions;
    setElementPositions(newPositions);
  }, [diagramCode]);

  // Generate PlantUML code from elements and relationships
  const generateCode = useCallback(() => {
    let code = '';

    // Generate element code
    for (const element of elements) {
      switch (element.type) {
        case 'Person':
          code += `Person(${element.id}, "${element.label}"${element.description ? `, "${element.description}"` : ''})\n`;
          break;
        case 'Container':
          code += `Container(${element.id}, "${element.label}"${element.technology ? `, "${element.technology}"` : ''}${element.description ? `, "${element.description}"` : ''})\n`;
          break;
        case 'System':
          code += `System(${element.id}, "${element.label}"${element.description ? `, "${element.description}"` : ''})\n`;
          break;
      }
    }

    code += '\n';

    // Generate relationship code
    for (const rel of relationships) {
      code += `Rel(${rel.from}, ${rel.to}, "${rel.label}"${rel.technology ? `, "${rel.technology}"` : ''})\n`;
    }

    const wrappedCode = `@startuml Diagram

    !include https://raw.githubusercontent.com/adrianvlupu/C4-PlantUML/latest/C4_Component.puml
    !include https://raw.githubusercontent.com/paulbrimicombe/stride-plantuml/main/stride.puml

    ${code}
    @enduml`;

    return wrappedCode;
  }, [elements, relationships]);

  // Update code when elements or relationships change
  useEffect(() => {
    if (elements.length === 0 && relationships.length === 0) return;
    const generatedCode = generateCode();
    onChange(generatedCode);
  }, [elements, relationships, onChange, generateCode]);

  const handleAddElement = (type: ElementType) => {
    const id = nextId.toString();
    setNextId(prevId => prevId + 1);
    
    // Calculate a good position for the new element - avoid overlaps
    const centerX = canvasRef.current ? canvasRef.current.clientWidth / 2 - position.x : 200;
    const centerY = canvasRef.current ? canvasRef.current.clientHeight / 2 - position.y : 150;
    
    // Find a spot with some spacing between elements
    const count = elements.length;
    const col = count % 3;
    const row = Math.floor(count / 3);
    const x = centerX - 150 + col * 180;
    const y = centerY - 100 + row * 120;
    
    const newPosition = { x, y };
    const newElement = {
      id,
      type,
      label: `New ${type}`,
      description: '',
      x,
      y
    };
    
    // Update position tracking
    positionMapRef.current[id] = newPosition;
    setElementPositions({...positionMapRef.current});
    
    setElements([...elements, newElement]);
    setSelectedElement(id);
  };

  const handleElementDrop = (id: string, x: number, y: number) => {
    // Update position in our tracking object
    positionMapRef.current[id] = { x, y };
    setElementPositions({...positionMapRef.current});
    
    setElements(
      elements.map((elem) => 
        elem.id === id ? { ...elem, x, y } : elem
      )
    );
  };

  const handleElementClick = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (relationshipMode) {
      if (!relationshipStart) {
        // First element in relationship
        setRelationshipStart(id);
      } else if (relationshipStart !== id) {
        // Second element - create relationship
        const newRelId = `rel_${Date.now()}`;
        setRelationships([
          ...relationships,
          {
            id: newRelId,
            from: relationshipStart,
            to: id,
            label: 'Uses'
          }
        ]);
        
        // Exit relationship mode
        setRelationshipMode(false);
        setRelationshipStart(null);
        setSelectedElement(newRelId);
      }
    } else {
      setSelectedElement(id === selectedElement ? null : id);
    }
  };

  const handleAddRelationship = () => {
    setRelationshipMode(true);
    setRelationshipStart(null);
    setSelectedElement(null);
  };

  const handleUpdateElement = (id: string, updates: Partial<ElementData>) => {
    setElements(
      elements.map((elem) => 
        elem.id === id ? { ...elem, ...updates } : elem
      )
    );
  };

  const handleUpdateRelationship = (id: string, updates: Partial<RelationshipData>) => {
    setRelationships(
      relationships.map((rel) => 
        rel.id === id ? { ...rel, ...updates } : rel
      )
    );
  };

  const handleDeleteElement = (id: string) => {
    setElements(elements.filter(elem => elem.id !== id));
    // Remove relationships connected to this element
    setRelationships(relationships.filter(rel => rel.from !== id && rel.to !== id));
    
    // Remove position from tracking
    const newPositions = {...positionMapRef.current};
    delete newPositions[id];
    positionMapRef.current = newPositions;
    setElementPositions(newPositions);
    
    if (selectedElement === id) {
      setSelectedElement(null);
    }
  };

  const handleDeleteRelationship = (id: string) => {
    setRelationships(relationships.filter(rel => rel.id !== id));
    if (selectedElement === id) {
      setSelectedElement(null);
    }
  };

  const handleCanvasClick = () => {
    if (relationshipMode) {
      // Cancel relationship creation
      setRelationshipMode(false);
      setRelationshipStart(null);
    }
    setSelectedElement(null);
  };
  
  // Canvas pan and zoom handlers
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // Only enable panning when not in relationship mode and using middle mouse button or space+left click
    if ((e.button === 1 || (e.button === 0 && e.shiftKey)) && !relationshipMode) {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  }, [relationshipMode]);
  
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDraggingCanvas) {
      const dx = (e.clientX - dragStart.x) / scale;
      const dy = (e.clientY - dragStart.y) / scale;
      setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [isDraggingCanvas, dragStart, scale]);
  
  const handleCanvasMouseUp = useCallback(() => {
    if (isDraggingCanvas) {
      setIsDraggingCanvas(false);
    }
  }, [isDraggingCanvas]);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setScale(s => Math.max(0.5, Math.min(2, s + delta)));
  }, []);
  
  const handleCanvasKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Use arrow keys to pan
    switch (e.key) {
      case 'ArrowUp':
        setPosition(prev => ({ x: prev.x, y: prev.y + 20 }));
        e.preventDefault();
        break;
      case 'ArrowDown':
        setPosition(prev => ({ x: prev.x, y: prev.y - 20 }));
        e.preventDefault();
        break;
      case 'ArrowLeft':
        setPosition(prev => ({ x: prev.x + 20, y: prev.y }));
        e.preventDefault();
        break;
      case 'ArrowRight':
        setPosition(prev => ({ x: prev.x - 20, y: prev.y }));
        e.preventDefault();
        break;
      case '0':
        if (e.ctrlKey || e.metaKey) {
          setScale(1);
          setPosition({ x: 0, y: 0 });
          e.preventDefault();
        }
        break;
    }
  }, []);

  // Component for draggable C4 element
  const DiagramElement: FC<{ element: ElementData }> = ({ element }) => {
    const [{ isDragging }, dragRef] = useDrag({
      type: 'element',
      item: { id: element.id, type: 'element' },
      collect: monitor => ({
        isDragging: !!monitor.isDragging()
      })
    });

    const isSelected = selectedElement === element.id;
    const isRelStart = relationshipStart === element.id;
    
    const iconMap: Record<ElementType, string> = {
      Person: '👤',
      Container: '📦',
      System: '🖥️',
      Relationship: '🔗'
    };

    return (
      <div
        // @ts-ignore
        ref={dragRef}
        className={`absolute p-2 rounded-lg shadow-md cursor-move ${
          isSelected ? 'ring-2 ring-blue-500' : ''
        } ${isRelStart ? 'ring-2 ring-green-500' : ''} ${
          element.type === 'Person' ? 'bg-blue-100' : 
          element.type === 'Container' ? 'bg-green-100' : 'bg-yellow-100'
        }`}
        style={{
          left: element.x,
          top: element.y,
          opacity: isDragging ? 0.5 : 1,
          width: '120px',
          zIndex: isSelected || isRelStart ? 10 : 1,
          transformOrigin: 'top left',
        }}
        onClick={(e) => handleElementClick(element.id, e)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleElementClick(element.id, e as unknown as React.MouseEvent);
          }
        }}
        // biome-ignore lint/a11y/useSemanticElements: <explanation>
        role="button"
        tabIndex={0}
      >
        <div className="flex items-center justify-between">
          <span className="text-lg">{iconMap[element.type]}</span>
          <button 
            type="button"
            className="text-red-500 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteElement(element.id);
            }}
          >
            ×
          </button>
        </div>
        <div className="text-xs font-semibold truncate mt-1">{element.label}</div>
        {element.type === 'Container' && element.technology && (
          <div className="text-xs text-gray-500 truncate">{element.technology}</div>
        )}
      </div>
    );
  };

  // Render relationship lines
  const RelationshipLine: FC<{ relationship: RelationshipData }> = ({ relationship }) => {
    const fromElement = elements.find(e => e.id === relationship.from);
    const toElement = elements.find(e => e.id === relationship.to);
    
    if (!fromElement || !toElement) return null;

    // Calculate positions for the line
    const fromX = fromElement.x + 60; // center of element
    const fromY = fromElement.y + 30;
    const toX = toElement.x + 60;
    const toY = toElement.y + 30;
    
    // Calculate midpoint for label
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    
    // Calculate angle for arrow
    const angle = Math.atan2(toY - fromY, toX - fromX) * 180 / Math.PI;
    
    const isSelected = selectedElement === relationship.id;
    
    return (
      <>
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: <explanation> */}
        <line
          x1={fromX}
          y1={fromY}
          x2={toX}
          y2={toY}
          stroke={isSelected ? "blue" : "black"}
          strokeWidth={isSelected ? 3 : 2}
          strokeDasharray={isSelected ? "5,5" : "none"}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedElement(relationship.id);
          }}
          style={{ cursor: 'pointer' }}
        />
        <polygon 
          points={`${toX},${toY} ${toX-10},${toY-5} ${toX-10},${toY+5}`}
          transform={`rotate(${angle} ${toX} ${toY})`}
          fill={isSelected ? "blue" : "black"}
        />
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: <explanation> */}
        <foreignObject 
          x={midX - 50} 
          y={midY - 15} 
          width="100" 
          height="30"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedElement(relationship.id);
          }}
        >
          <div 
            className={`text-xs bg-white p-1 rounded shadow text-center ${
              isSelected ? 'ring-2 ring-blue-500' : ''
            }`}
            style={{ cursor: 'pointer' }}
          >
            {relationship.label}
          </div>
        </foreignObject>
      </>
    );
  };

  // Canvas where elements are dropped
  const Canvas = () => {
    const [, drop] = useDrop({
      accept: 'element',
      drop: (item: DragItem, monitor) => {
        const delta = monitor.getDifferenceFromInitialOffset();
        if (!delta) return;
        
        const element = elements.find(e => e.id === item.id);
        if (!element) return;
        
        const x = Math.round(element.x + delta.x / scale);
        const y = Math.round(element.y + delta.y / scale);
        
        handleElementDrop(item.id, x, y);
        return undefined;
      }
    });

    return (
      <div 
        ref={node => {
          drop(node);
          canvasRef.current = node;
        }}
        className="h-full w-full relative overflow-hidden bg-gray-50 border rounded-md"
        onClick={handleCanvasClick}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onWheel={handleWheel}
        onKeyDown={handleCanvasKeyDown}
        style={{ 
          minHeight: '500px',
          cursor: isDraggingCanvas ? 'grabbing' : 'default',
          position: 'relative'
        }}
      >
        <div className="absolute left-2 bottom-2 bg-white rounded px-2 py-1 text-xs shadow z-30">
          <button 
            type="button"
            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded mr-1"
            onClick={() => setScale(s => Math.min(s + 0.1, 2))}
          >
            +
          </button>
          <span className="mx-1">{Math.round(scale * 100)}%</span>
          <button 
            type="button"
            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded mr-1"
            onClick={() => setScale(s => Math.max(s - 0.1, 0.5))}
          >
            -
          </button>
          <button 
            type="button"
            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
            onClick={() => {
              setScale(1);
              setPosition({ x: 0, y: 0 });
            }}
          >
            Reset
          </button>
        </div>
        
        {relationshipMode && (
          <div className="absolute top-2 left-2 right-2 bg-green-100 text-green-800 p-2 rounded shadow z-20">
            {relationshipStart 
              ? "Now click on the destination element to create a relationship" 
              : "Click on the first element to start creating a relationship"}
          </div>
        )}
        
        <div 
          style={{
            transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
            transformOrigin: '0 0',
            width: '100%',
            height: '100%',
            position: 'absolute'
          }}
        >
          {/* SVG for relationships */}
          <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
            <title>Diagram Relationships</title>
            <g className="pointer-events-auto">
              {relationships.map(rel => (
                <RelationshipLine key={rel.id} relationship={rel} />
              ))}
            </g>
          </svg>
          
          {/* Elements */}
          {elements.map(element => (
            <DiagramElement key={element.id} element={element} />
          ))}
        </div>
      </div>
    );
  };

  // Properties panel for selected element
  const PropertiesPanel = () => {
    if (!selectedElement) return null;

    const element = elements.find(e => e.id === selectedElement);
    const relationship = relationships.find(r => r.id === selectedElement);

    if (!element && !relationship) return null;

    if (element) {
      return (
        <div className="p-4 bg-white border rounded-md shadow-sm">
          <h3 className="font-medium text-sm mb-2">Element Properties</h3>
          <div className="space-y-2">
            <div>
              <label htmlFor="element-type" className="block text-xs text-gray-500">Type</label>
              <div id="element-type" className="text-sm">{element.type}</div>
            </div>
            <div>
              <label htmlFor="element-label" className="block text-xs text-gray-500">Label</label>
              <input
                id="element-label"
                type="text"
                value={element.label}
                onChange={(e) => handleUpdateElement(element.id, { label: e.target.value })}
                className="w-full px-2 py-1 text-sm border rounded"
              />
            </div>
            {element.type === 'Container' && (
              <div>
                <label htmlFor="element-tech" className="block text-xs text-gray-500">Technology</label>
                <input
                  id="element-tech"
                  type="text"
                  value={element.technology || ''}
                  onChange={(e) => handleUpdateElement(element.id, { technology: e.target.value })}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
            )}
            <div>
              <label htmlFor="element-desc" className="block text-xs text-gray-500">Description</label>
              <textarea
                id="element-desc"
                value={element.description}
                onChange={(e) => handleUpdateElement(element.id, { description: e.target.value })}
                rows={2}
                className="w-full px-2 py-1 text-sm border rounded"
              />
            </div>
          </div>
        </div>
      );
    }

    if (relationship) {
      return (
        <div className="p-4 bg-white border rounded-md shadow-sm">
          <h3 className="font-medium text-sm mb-2">Relationship Properties</h3>
          <div className="space-y-2">
            <div>
              <label htmlFor="rel-from" className="block text-xs text-gray-500">From</label>
              <select
                id="rel-from"
                value={relationship.from}
                onChange={(e) => handleUpdateRelationship(relationship.id, { from: e.target.value })}
                className="w-full px-2 py-1 text-sm border rounded"
              >
                {elements.map(elem => (
                  <option key={elem.id} value={elem.id}>
                    {elem.label} ({elem.type})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rel-to" className="block text-xs text-gray-500">To</label>
              <select
                id="rel-to"
                value={relationship.to}
                onChange={(e) => handleUpdateRelationship(relationship.id, { to: e.target.value })}
                className="w-full px-2 py-1 text-sm border rounded"
              >
                {elements.map(elem => (
                  <option key={elem.id} value={elem.id}>
                    {elem.label} ({elem.type})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rel-label" className="block text-xs text-gray-500">Label</label>
              <input
                id="rel-label"
                type="text"
                value={relationship.label}
                onChange={(e) => handleUpdateRelationship(relationship.id, { label: e.target.value })}
                className="w-full px-2 py-1 text-sm border rounded"
              />
            </div>
            <div>
              <label htmlFor="rel-tech" className="block text-xs text-gray-500">Technology</label>
              <input
                id="rel-tech"
                type="text"
                value={relationship.technology || ''}
                onChange={(e) => handleUpdateRelationship(relationship.id, { technology: e.target.value })}
                className="w-full px-2 py-1 text-sm border rounded"
              />
            </div>
            <button
              type="button"
              onClick={() => handleDeleteRelationship(relationship.id)}
              className="px-2 py-1 text-xs text-white bg-red-500 rounded hover:bg-red-600 mt-2"
            >
              Delete Relationship
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-full">
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => handleAddElement('Person')}
            className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 rounded-md flex items-center space-x-1"
          >
            <span>👤</span>
            <span>Add Person</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddElement('Container')}
            className="px-3 py-1 text-sm bg-green-100 hover:bg-green-200 rounded-md flex items-center space-x-1"
          >
            <span>📦</span>
            <span>Add Container</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddElement('System')}
            className="px-3 py-1 text-sm bg-yellow-100 hover:bg-yellow-200 rounded-md flex items-center space-x-1"
          >
            <span>🖥️</span>
            <span>Add System</span>
          </button>
          <button
            type="button"
            onClick={handleAddRelationship}
            className={`px-3 py-1 text-sm rounded-md flex items-center space-x-1 ${
              relationshipMode 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <span>🔗</span>
            <span>{relationshipMode ? 'Cancel' : 'Add Relationship'}</span>
          </button>
        </div>
        
        <div className="flex flex-1 space-x-4">
          <div className="flex-1">
            <Canvas />
          </div>
          <div className="w-64">
            <PropertiesPanel />
          </div>
        </div>
      </div>
    </DndProvider>
  );
};

export default DiagramEditor; 