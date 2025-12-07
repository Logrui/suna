import dagre from 'dagre';
import { Node, Edge, Position } from '@xyflow/react';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 300;
const nodeHeight = 150; // Approximate height, can be adjusted or dynamic

export const getLayoutedElements = (
    nodes: Node[],
    edges: Edge[],
    direction = 'TB'
) => {
    const isHorizontal = direction === 'LR';
    dagreGraph.setGraph({ rankdir: direction });

    nodes.forEach((node) => {
        // Adjust dimensions based on node type if needed
        let width = nodeWidth;
        let height = nodeHeight;

        if (node.type === 'LLM_CONDITION' || node.type === 'RULE_CONDITION') {
            width = 250;
            height = 100;
        } else if (node.type === 'STOP') {
            width = 200;
            height = 80;
        }

        dagreGraph.setNode(node.id, { width, height });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const newNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        const newNode = {
            ...node,
            targetPosition: isHorizontal ? Position.Left : Position.Top,
            sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
            // We are shifting the dagre node position (anchor=center center) to the top left
            // so it matches the React Flow node anchor point (top left).
            position: {
                x: nodeWithPosition.x - (node.measured?.width ?? nodeWidth) / 2,
                y: nodeWithPosition.y - (node.measured?.height ?? nodeHeight) / 2,
            },
        };

        return newNode;
    });

    return { nodes: newNodes, edges };
};
