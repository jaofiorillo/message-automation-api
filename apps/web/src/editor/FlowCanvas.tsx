import {
  Background,
  BackgroundVariant,
  MarkerType,
  Panel,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type FinalConnectionState,
  type NodeChange,
} from '@xyflow/react';
import { Maximize, Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { CommentTrigger, Draft, KeywordRule } from '../api/types';
import {
  addContent,
  connect,
  edgesOf,
  freePosition,
  moveNode,
  parseSourceHandle,
  removeContent,
  triggerNodeId,
} from './model';
import { ContentNode, type ContentFlowNode } from './nodes/ContentNode';
import { TriggerNode, type TriggerFlowNode } from './nodes/TriggerNode';
import type { FlowEditor } from './useFlowEditor';

const nodeTypes = { trigger: TriggerNode, content: ContentNode };

type CanvasNode = TriggerFlowNode | ContentFlowNode;

export type Selection =
  | { kind: 'content'; oid: string }
  | { kind: 'keyword'; rule?: KeywordRule }
  | { kind: 'comment'; trigger?: CommentTrigger }
  | null;

interface Props {
  editor: FlowEditor;
  keywords: KeywordRule[];
  comments: CommentTrigger[];
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onAddTrigger: () => void;
}

function buildNodes(
  draft: Draft,
  props: Props,
  readOnly: boolean,
): CanvasNode[] {
  const at = (id: string, fallbackX: number) =>
    draft.coordinates[id] ?? { x: fallbackX, y: 0 };
  const trigger: TriggerFlowNode = {
    id: triggerNodeId,
    type: 'trigger',
    position: at(triggerNodeId, -420),
    deletable: false,
    selected:
      props.selection?.kind === 'keyword' ||
      props.selection?.kind === 'comment',
    data: {
      keywords: props.keywords,
      comments: props.comments,
      readOnly,
      onAdd: props.onAddTrigger,
      onOpenKeyword: (rule) => props.onSelect({ kind: 'keyword', rule }),
      onOpenComment: (comment) =>
        props.onSelect({ kind: 'comment', trigger: comment }),
    },
  };
  const contents: ContentFlowNode[] = draft.contents.map((content, index) => ({
    id: content.oid,
    type: 'content',
    position: at(content.oid, index * 420),
    selected:
      props.selection?.kind === 'content' &&
      props.selection.oid === content.oid,
    data: { content, isRoot: content.oid === draft.rootContent },
  }));
  return [trigger, ...contents];
}

function buildEdges(draft: Draft): Edge[] {
  return edgesOf(draft).map((edge) => ({
    ...edge,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: '#8a94a6',
      width: 18,
      height: 18,
    },
  }));
}

// The flow builder canvas. React Flow keeps its own copy of nodes and edges
// for dragging and selection; every real change goes back to the draft
// through `editor.change`, and the copy is rebuilt from the draft.
export function FlowCanvas(props: Props) {
  const { editor, onSelect } = props;
  const { draft, change } = editor;
  const readOnly = editor.mode === 'view';
  const flow = useReactFlow();
  const [nodes, setNodes] = useState<CanvasNode[]>(() =>
    buildNodes(draft, props, readOnly),
  );
  const [edges, setEdges] = useState<Edge[]>(() => buildEdges(draft));

  useEffect(() => {
    setNodes((previous) => {
      const byId = new Map(previous.map((node) => [node.id, node]));
      return buildNodes(draft, props, readOnly).map(
        (node) => ({ ...byId.get(node.id), ...node }) as CanvasNode,
      );
    });
    // props holds callbacks that change identity every render; the inputs
    // that matter are listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, props.keywords, props.comments, props.selection, readOnly]);

  useEffect(() => {
    setEdges((previous) => {
      const selected = new Set(
        previous.filter((e) => e.selected).map((e) => e.id),
      );
      return buildEdges(draft).map((edge) => ({
        ...edge,
        selected: selected.has(edge.id),
      }));
    });
  }, [draft]);

  // Drags move the local copy only; the draft gets the final position on
  // drag stop, so one drag is one undo step and one save.
  // Bring the selected step into view when it is off-screen (a step just
  // created from a button or "Próximo Passo" lands to the right).
  const selectedOid =
    props.selection?.kind === 'content' ? props.selection.oid : null;
  useEffect(() => {
    if (!selectedOid) return;
    const point = draft.coordinates[selectedOid];
    const box = document.querySelector('.react-flow')?.getBoundingClientRect();
    if (!point || !box) return;
    const zoom = flow.getZoom();
    const topLeft = flow.flowToScreenPosition(point);
    const width = 280 * zoom;
    const height = 160 * zoom;
    const visible =
      topLeft.x >= box.left &&
      topLeft.y >= box.top &&
      topLeft.x + width <= box.right &&
      topLeft.y + height <= box.bottom;
    if (!visible) {
      void flow.setCenter(point.x + 140, point.y + 80, { zoom, duration: 300 });
    }
    // Only when the selection changes, not on every draft edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOid]);

  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) =>
      setNodes((current) => applyNodeChanges(changes, current)),
    [],
  );

  const onNodeDragStop = useCallback(
    (_event: unknown, _node: CanvasNode, dragged: CanvasNode[]) => {
      change((d) =>
        dragged.reduce(
          (next, node) =>
            moveNode(next, node.id, {
              x: Math.round(node.position.x),
              y: Math.round(node.position.y),
            }),
          d,
        ),
      );
    },
    [change],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((current) => applyEdgeChanges(changes, current)),
    [],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const source = parseSourceHandle(
        connection.source,
        connection.sourceHandle,
      );
      if (source) change((d) => connect(d, source, connection.target));
    },
    [change],
  );

  // Dropping a link on empty canvas creates a new step there and links it,
  // like ManyChat's "drag from a handle".
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      if (
        state.isValid ||
        !state.fromNode ||
        state.fromHandle?.type !== 'source'
      )
        return;
      const source = parseSourceHandle(state.fromNode.id, state.fromHandle.id);
      if (!source) return;
      const point = 'changedTouches' in event ? event.changedTouches[0] : event;
      const position = flow.screenToFlowPosition({
        x: point.clientX,
        y: point.clientY - 30,
      });
      let created = '';
      change((d) => {
        const added = addContent(d, {
          x: Math.round(position.x),
          y: Math.round(position.y),
        });
        created = added.oid;
        return connect(added.draft, source, added.oid);
      });
      if (created) onSelect({ kind: 'content', oid: created });
    },
    [change, flow, onSelect],
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      change((d) =>
        deleted.reduce((next, edge) => {
          const source = parseSourceHandle(edge.source, edge.sourceHandle);
          return source ? connect(next, source, null) : next;
        }, d),
      );
    },
    [change],
  );

  const onNodesDelete = useCallback(
    (deleted: CanvasNode[]) => {
      change((d) =>
        deleted.reduce((next, node) => removeContent(next, node.id), d),
      );
      onSelect(null);
    },
    [change, onSelect],
  );

  const addStep = () => {
    const box = document.querySelector('.react-flow')?.getBoundingClientRect();
    const center = flow.screenToFlowPosition({
      x: (box?.left ?? 0) + (box?.width ?? 800) / 2,
      y: (box?.top ?? 0) + (box?.height ?? 600) / 2,
    });
    let created = '';
    change((d) => {
      const added = addContent(
        d,
        freePosition(d, {
          x: Math.round(center.x - 140),
          y: Math.round(center.y - 60),
        }),
      );
      created = added.oid;
      return added.draft;
    });
    if (created) onSelect({ kind: 'content', oid: created });
  };

  return (
    <ReactFlow<CanvasNode, Edge>
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={onNodeDragStop}
      onConnect={onConnect}
      onConnectEnd={onConnectEnd}
      onEdgesDelete={onEdgesDelete}
      onNodesDelete={onNodesDelete}
      onNodeClick={(_event, node) => {
        if (node.type === 'content')
          onSelect({ kind: 'content', oid: node.id });
        else if (
          props.keywords.length + props.comments.length === 0 &&
          !readOnly
        )
          props.onAddTrigger();
      }}
      onPaneClick={() => onSelect(null)}
      isValidConnection={(connection) =>
        connection.target !== triggerNodeId &&
        connection.source !== connection.target
      }
      nodesDraggable={!readOnly}
      nodesConnectable={!readOnly}
      edgesFocusable={!readOnly}
      deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
      fitView
      fitViewOptions={{ maxZoom: 1, padding: 0.3 }}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1}
        color="#dcdcdc"
      />
      {!readOnly && (
        <Panel position="top-right" className="m-5!">
          <button
            type="button"
            aria-label="Adicionar etapa"
            title="Adicionar etapa"
            onClick={addStep}
            className="grid size-15 place-items-center rounded-full bg-primary text-white shadow-lg hover:bg-primary-hover"
          >
            <Plus className="size-7" />
          </button>
        </Panel>
      )}
      <Panel position="bottom-right" className="mr-6! mb-6! grid gap-2">
        <CanvasButton label="Ampliar" onClick={() => void flow.zoomIn()}>
          <Plus className="size-4.5" />
        </CanvasButton>
        <CanvasButton label="Reduzir" onClick={() => void flow.zoomOut()}>
          <Minus className="size-4.5" />
        </CanvasButton>
        <CanvasButton
          label="Ajustar à tela"
          onClick={() => void flow.fitView({ maxZoom: 1, padding: 0.3 })}
        >
          <Maximize className="size-4" />
        </CanvasButton>
      </Panel>
    </ReactFlow>
  );
}

function CanvasButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-md border border-line bg-white hover:bg-black/[0.03]"
    >
      {children}
    </button>
  );
}
