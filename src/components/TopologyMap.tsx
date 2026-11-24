import React, { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PfSenseConfig } from '../types';
import CustomNetworkNode from './CustomNetworkNode';
import { Map as MapIcon, X } from 'lucide-react';

// Map node custom rendering to CustomNetworkNode
const nodeTypes = {
  customNetwork: CustomNetworkNode,
};

interface TopologyMapProps {
  config?: PfSenseConfig;
  customNodes: any[];
  customEdges: any[];
  nodePositions: { [nodeId: string]: { x: number; y: number } };
  onNodeDragStop: (nodeId: string, position: { x: number; y: number }) => void;
  onConnect: (connection: any) => void;
  onSelectNode: (node: any | null) => void;
  onSelectEdge: (edge: any | null) => void;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
}

export default function TopologyMap({
  config,
  customNodes,
  customEdges,
  nodePositions,
  onNodeDragStop,
  onConnect,
  onSelectNode,
  onSelectEdge,
  selectedNodeId,
  selectedEdgeId,
}: TopologyMapProps) {
  const [showHint, setShowHint] = useState(true);
  const [isMiniMapOpen, setIsMiniMapOpen] = useState(false);
  const miniMapRef = useRef<HTMLDivElement>(null);

  // Close MiniMap when clicking outside of it
  useEffect(() => {
    if (!isMiniMapOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (miniMapRef.current && !miniMapRef.current.contains(event.target as Node)) {
        setIsMiniMapOpen(false);
      }
    };

    // Add listener after slight timeout so click that opened it doesn't close it immediately
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isMiniMapOpen]);

  // Auto-hide connection warning after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowHint(false);
    }, 10000);
    return () => clearTimeout(timer);
  }, []);
  
  // Calculate initial visual coordinates for XML nodes to be beautifully structured layout-wise
  const builtInNodes = useMemo(() => {
    const nodes: any[] = [];
    if (!config) return nodes;

    // 1. Core Router Node (pfSense)
    const pfsensePos = nodePositions['pfsense'] || { x: 500, y: 350 };
    nodes.push({
      id: 'pfsense',
      type: 'customNetwork',
      position: pfsensePos,
      selected: selectedNodeId === 'pfsense',
      data: {
        label: config.system.hostname || 'pfSense',
        type: 'pfsense',
        ip: config.interfaces.find(i => i.id === 'lan')?.ipaddr || '192.168.1.1',
        descr: config.system.domain ? `Domínio: ${config.system.domain}` : 'Roteador Core Firewall',
        model: config.version ? `v${config.version}` : 'pfSense CE',
      },
    });

    // 2. WAN Interfaces / Gateways
    const gateways = config.gateways.gateway_item || [];
    gateways.forEach((gw, idx) => {
      const gwId = `gw-${gw.name}`;
      const fallbackPos = { 
        x: 500 + (idx - (gateways.length - 1) / 2) * 220, 
        y: 120 
      };
      
      nodes.push({
        id: gwId,
        type: 'customNetwork',
        position: nodePositions[gwId] || fallbackPos,
        selected: selectedNodeId === gwId,
        data: {
          label: gw.name || 'WAN',
          type: 'gateway',
          ip: gw.gateway || 'DHCP/WAN',
          descr: gw.descr || `Interface física: ${gw.interface}`,
          model: gw.monitor ? `DNS monitor: ${gw.monitor}` : undefined
        },
      });
    });

    // 3. LAN Interfaces & VLANs
    const interfaces = config.interfaces.filter(i => i.id.startsWith('opt') || i.id === 'lan');
    const vlans = config.vlans || [];
    
    interfaces.forEach((lan, idx) => {
      const lanId = `lan-${lan.id}`;
      // Search matching VLAN definition to see if it's a VLAN interface instead of raw physical port
      const matchingVlan = vlans.find(v => v.vlanif === lan.if || v.if === lan.if || lan.if?.includes(v.tag));
      
      const fallbackPos = {
        x: 350 + idx * 220,
        y: 580,
      };

      nodes.push({
        id: lanId,
        type: 'customNetwork',
        position: nodePositions[lanId] || fallbackPos,
        selected: selectedNodeId === lanId,
        data: {
          label: lan.descr || lan.id.toUpperCase(),
          type: matchingVlan ? 'vlan' : 'interface',
          ip: lan.ipaddr ? `${lan.ipaddr}/${lan.subnet || '24'}` : 'Configurado DHCP',
          vlan: matchingVlan ? matchingVlan.tag : undefined,
          descr: `Porta física: ${lan.if}`,
        },
      });
    });

    // 4. IPsec Phase 1 VPN tunnels
    const phase1 = config.ipsec?.phase1 || [];
    phase1.forEach((vpn, idx) => {
      const vpnId = `vpn-${vpn.ikeid}`;
      const fallbackPos = {
        x: 900,
        y: 300 + idx * 140,
      };

      nodes.push({
        id: vpnId,
        type: 'customNetwork',
        position: nodePositions[vpnId] || fallbackPos,
        selected: selectedNodeId === vpnId,
        data: {
          label: vpn.descr || `VPN Tunnel #${vpn.ikeid}`,
          type: 'vpn',
          ip: vpn.remote_gateway,
          descr: `Criptografia: ${vpn.encryption_algorithm.name}`,
          model: `IKE: ${vpn.dhgroup}-SHA${vpn.hash_algorithm.replace(/sha/i, '')}`,
        },
      });
    });

    return nodes;
  }, [config, nodePositions, selectedNodeId]);

  // Combine built-in nodes from XML and custom manually added nodes
  const allNodes = useMemo(() => {
    // Custom nodes already have coordinates, but ensure they have positions updated from dict
    const processedCustomNodes = customNodes.map(node => {
      const savedPos = nodePositions[node.id];
      return {
        ...node,
        type: 'customNetwork',
        selected: selectedNodeId === node.id,
        position: savedPos || node.position,
      };
    });

    return [...builtInNodes, ...processedCustomNodes];
  }, [builtInNodes, customNodes, nodePositions, selectedNodeId]);

  // Default connections based on XML configuration
  const xmlEdges = useMemo(() => {
    const edges: any[] = [];
    if (!config) return edges;

    // Connect WANs to Core
    config.gateways.gateway_item.forEach((gw) => {
      const gwId = `gw-${gw.name}`;
      edges.push({
        id: `e-gw-${gw.name}`,
        source: gwId,
        target: 'pfsense',
        animated: true,
        selected: selectedEdgeId === `e-gw-${gw.name}`,
        style: { stroke: '#3b82f6', strokeWidth: 2.5 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#3b82f6',
        },
      });
    });

    // Connect Core to LAN Interfaces
    const interfaces = config.interfaces.filter(i => i.id.startsWith('opt') || i.id === 'lan');
    interfaces.forEach((lan) => {
      const lanId = `lan-${lan.id}`;
      edges.push({
        id: `e-lan-${lan.id}`,
        source: 'pfsense',
        target: lanId,
        selected: selectedEdgeId === `e-lan-${lan.id}`,
        style: { stroke: '#10b981', strokeWidth: 2.5 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#10b981',
        },
      });
    });

    // Connect IPsec VPNs
    const phase1 = config.ipsec?.phase1 || [];
    phase1.forEach((vpn) => {
      const vpnId = `vpn-${vpn.ikeid}`;
      edges.push({
        id: `e-vpn-${vpn.ikeid}`,
        source: 'pfsense',
        target: vpnId,
        animated: true,
        selected: selectedEdgeId === `e-vpn-${vpn.ikeid}`,
        style: { stroke: '#6366f1', strokeWidth: 2.5, strokeDasharray: '6 6' },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#6366f1',
        },
      });
    });

    return edges;
  }, [config, selectedEdgeId]);

  // Merge XML edges and Custom edges
  const allEdges = useMemo(() => {
    const processedCustomEdges = customEdges.map(edge => ({
      ...edge,
      selected: selectedEdgeId === edge.id,
    }));
    return [...xmlEdges, ...processedCustomEdges];
  }, [xmlEdges, customEdges, selectedEdgeId]);

  // Hook elements for local rendering and flow-reactive changes
  const [nodes, setNodes, onNodesChange] = useNodesState(allNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(allEdges);

  // Synchronize internal nodes when parent props update
  useEffect(() => {
    setNodes(allNodes);
  }, [allNodes, setNodes]);

  // Synchronize internal edges when parent props update
  useEffect(() => {
    setEdges(allEdges);
  }, [allEdges, setEdges]);

  // Triggered when anything on diagram is clicked
  const onNodeClick = useCallback((_: any, node: any) => {
    onSelectNode(node);
    onSelectEdge(null);
  }, [onSelectNode, onSelectEdge]);

  const onEdgeClick = useCallback((_: any, edge: any) => {
    onSelectEdge(edge);
    onSelectNode(null);
  }, [onSelectEdge, onSelectNode]);

  const onPaneClick = useCallback(() => {
    onSelectNode(null);
    onSelectEdge(null);
  }, [onSelectNode, onSelectEdge]);

  // Captured drag stop coordinate adjustments to propagate to parent state
  const handleDragEnd = useCallback((event: any, node: any) => {
    onNodeDragStop(node.id, node.position);
  }, [onNodeDragStop]);

  return (
    <div className="w-full h-full bg-[#f8fafc] rounded-3xl overflow-hidden border border-slate-200/50 shadow-inner relative" id="topology_map_flow_wrapper">
      
      {/* Premium ambient decorative glowing blurs behind the schematic canvas, fully isolated */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-pink-300/25 to-rose-400/20 blur-[130px] mix-blend-multiply opacity-80" />
        <div className="absolute bottom-[10%] right-[15%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-indigo-300/20 to-blue-400/25 blur-[150px] mix-blend-multiply opacity-85" />
        <div className="absolute top-[35%] right-[30%] w-[450px] h-[450px] rounded-full bg-gradient-to-r from-purple-300/20 to-pink-300/15 blur-[120px] mix-blend-screen opacity-75" />
        
        {/* Frosted glass overlay explicitly sitting above the gradients, diffusing them */}
        <div className="absolute inset-0 bg-white/30 backdrop-blur-[35px]" />
      </div>

      <div className="absolute inset-0 z-10">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onNodeDragStop={handleDragEnd}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          attributionPosition="bottom-right"
          className="text-slate-800 font-sans bg-transparent"
        >
        <Controls showInteractive={true} className="bg-white border border-slate-200 shadow-xl rounded-xl p-0.5" />
        
        {isMiniMapOpen && (
          <div 
            ref={miniMapRef} 
            className="absolute bottom-4 right-4 z-50 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 shadow-2xl flex flex-col transition-all animate-fade-in"
            id="minimap_floating_container"
          >
            <div className="flex items-center justify-between px-2 pb-1 border-b border-slate-100 mb-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <MapIcon size={11} className="text-blue-500" /> Mini-Mapa
              </span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMiniMapOpen(false);
                }}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-all cursor-pointer"
                title="Fechar Mapa"
              >
                <X size={12} />
              </button>
            </div>
            
            <MiniMap 
              zoomable 
              pannable 
              nodeStrokeWidth={2}
              className="!m-0 rounded-xl border border-slate-100" 
              nodeColor={(node) => {
                const data = node.data as any;
                if (!data) return '#cbd5e1';
                switch (data.type) {
                  case 'pfsense': return '#f43f5e';
                  case 'gateway': return '#3b82f6';
                  case 'interface': return '#10b981';
                  case 'vlan': return '#a855f7';
                  case 'vpn': return '#6366f1';
                  case 'switch': return '#3f3f46';
                  case 'antenna': return '#f59e0b';
                  case 'ap': return '#f97316';
                  case 'server': return '#4f46e5';
                  case 'host': return '#64748b';
                  case 'camera': return '#14b8a6';
                  case 'printer': return '#06b6d4';
                  default: return '#94a3b8';
                }
              }} 
            />
          </div>
        )}

        <Background color="#64748b" gap={20} size={1.5} />
        </ReactFlow>
      </div>

      {/* Mini-map mini icon trigger when collapsed */}
      {!isMiniMapOpen && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMiniMapOpen(true);
          }}
          className="absolute bottom-4 right-4 z-40 w-10 h-10 bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-600 hover:text-slate-900 rounded-xl flex items-center justify-center shadow-md cursor-pointer transition-all active:scale-95"
          title="Abrir Mini-mapa"
          id="toggle_minimap_trigger"
        >
          <MapIcon size={18} className="stroke-[2.5]" />
        </button>
      )}

      {/* Manual connection hint */}
      {showHint && (
        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm pointer-events-none text-[10px] text-slate-500 font-medium animate-fade-out" style={{ animationDelay: '9.5s', animationDuration: '0.5s', animationFillMode: 'forwards' }}>
          💡 Arraste das bolinhas para interligar os equipamentos na topologia.
        </div>
      )}
    </div>
  );
}
