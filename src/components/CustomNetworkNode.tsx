import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { 
  Shield, 
  Globe, 
  Network, 
  Layers, 
  Radio, 
  Server, 
  Laptop, 
  Video, 
  Printer, 
  HelpCircle,
  Link2
} from 'lucide-react';

// Define the custom node data structure
export interface NetworkNodeData {
  label: string;
  type: string;
  ip?: string;
  mac?: string;
  model?: string;
  vlan?: string;
  descr?: string;
  isCustom?: boolean;
}

const getIcon = (type: string, size = 20) => {
  switch (type) {
    case 'pfsense':
      return <Shield size={size} className="text-rose-600" />;
    case 'gateway':
      return <Globe size={size} className="text-blue-600" />;
    case 'interface':
      return <Network size={size} className="text-emerald-600" />;
    case 'vlan':
      return <Network size={size} className="text-purple-600 animate-pulse" />;
    case 'vpn':
      return <Link2 size={size} className="text-indigo-600" />;
    case 'switch':
      return <Layers size={size} className="text-zinc-700" />;
    case 'antenna':
      return <Radio size={size} className="text-amber-600" />;
    case 'ap':
      return <Radio size={size} className="text-orange-500" />;
    case 'server':
      return <Server size={size} className="text-indigo-600" />;
    case 'host':
      return <Laptop size={size} className="text-slate-600" />;
    case 'camera':
      return <Video size={size} className="text-teal-600" />;
    case 'printer':
      return <Printer size={size} className="text-cyan-600" />;
    default:
      return <HelpCircle size={size} className="text-slate-500" />;
  }
};

const getColorClasses = (type: string, selected?: boolean) => {
  const selectedRing = selected ? 'ring-4 ring-blue-400 border-blue-500 scale-105' : 'hover:border-slate-400 hover:shadow-lg';
  switch (type) {
    case 'pfsense':
      return `bg-rose-50/95 border-rose-300 border-2 rounded-2xl shadow-md ${selectedRing}`;
    case 'gateway':
      return `bg-blue-50/95 border-blue-300 border-2 rounded-2xl shadow-md ${selectedRing}`;
    case 'interface':
      return `bg-emerald-50/95 border-emerald-300 border-2 rounded-2xl shadow-md ${selectedRing}`;
    case 'vlan':
      return `bg-purple-50/95 border-purple-300 border-2 rounded-2xl shadow-md ${selectedRing}`;
    case 'vpn':
      return `bg-indigo-50/95 border-indigo-300 border-2 rounded-2xl shadow-md border-dashed ${selectedRing}`;
    case 'switch':
      return `bg-zinc-50/95 border-zinc-300 border-2 rounded-2xl shadow-md ${selectedRing}`;
    case 'antenna':
      return `bg-amber-50/95 border-amber-300 border-2 rounded-2xl shadow-md ${selectedRing}`;
    case 'ap':
      return `bg-orange-50/95 border-orange-200 border-2 rounded-2xl shadow-md ${selectedRing}`;
    case 'server':
      return `bg-indigo-50/95 border-indigo-200 border-2 rounded-2xl shadow-md ${selectedRing}`;
    case 'host':
      return `bg-slate-50/95 border-slate-300 border-2 rounded-2xl shadow-md ${selectedRing}`;
    case 'camera':
      return `bg-teal-50/95 border-teal-200 border-2 rounded-2xl shadow-md ${selectedRing}`;
    case 'printer':
      return `bg-cyan-50/95 border-cyan-200 border-2 rounded-2xl shadow-md ${selectedRing}`;
    default:
      return `bg-white border-slate-200 border-2 rounded-2xl shadow-md ${selectedRing}`;
  }
};

const getTypeName = (type: string) => {
  switch (type) {
    case 'pfsense': return 'pfSense Core';
    case 'gateway': return 'Gateway WAN';
    case 'interface': return 'Interface LAN';
    case 'vlan': return 'VLAN Subrede';
    case 'vpn': return 'Túnel IPsec';
    case 'switch': return 'Switch de Rede';
    case 'antenna': return 'Antena PTP (Rádio)';
    case 'ap': return 'Access Point (AP)';
    case 'server': return 'Servidor Local';
    case 'host': return 'Dispositivo Genérico';
    case 'camera': return 'Câmera IP';
    case 'printer': return 'Impressora de Rede';
    default: return type.charAt(0).toUpperCase() + type.slice(1);
  }
};

export default function CustomNetworkNode({ data, selected }: { data: NetworkNodeData; selected?: boolean }) {
  const colorClass = getColorClasses(data.type, selected);
  
  return (
    <div className={`p-4 min-w-[190px] max-w-[250px] transition-all duration-200 ${colorClass}`} id={`node_${data.type}`}>
      {/* Handles to allow React Flow connections */}
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ background: '#94a3b8', width: '8px', height: '8px', borderRadius: '4px' }} 
        id="top"
      />
      <Handle 
        type="target" 
        position={Position.Left} 
        style={{ background: '#94a3b8', width: '8px', height: '8px', borderRadius: '4px' }} 
        id="left"
      />
      
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-lg bg-white shadow-sm shrink-0 border border-slate-100 flex items-center justify-center">
          {getIcon(data.type)}
        </div>
        <div className="overflow-hidden leading-tight flex-1">
          <p className="font-bold text-xs text-slate-800 truncate" title={data.label}>{data.label}</p>
          <span className="text-[10px] text-slate-400 font-medium">{getTypeName(data.type)}</span>
        </div>
      </div>

      {(data.ip || data.vlan || data.descr) && (
        <div className="mt-2 pt-1.5 border-t border-slate-100/50 flex flex-col gap-0.5 text-[10px]">
          {data.ip && (
            <div className="flex justify-between text-slate-600 font-mono">
              <span className="text-[8px] text-slate-400 font-sans">IP:</span>
              <span>{data.ip}</span>
            </div>
          )}
          {data.vlan && (
            <div className="flex justify-between text-slate-600 font-mono">
              <span className="text-[8px] text-slate-400 font-sans">VLAN:</span>
              <span className="bg-purple-100/80 text-purple-700 px-1 rounded text-[9px] font-bold">{data.vlan}</span>
            </div>
          )}
          {data.model && (
            <div className="flex justify-between text-slate-500 font-mono truncate">
              <span className="text-[8px] text-slate-400 font-sans">Mod:</span>
              <span className="truncate max-w-[100px] text-right" title={data.model}>{data.model}</span>
            </div>
          )}
        </div>
      )}

      {data.isCustom && (
        <div className="absolute -top-2.5 -right-1 bg-zinc-700 text-[8px] text-white font-mono font-bold px-1.5 py-0.5 rounded-full shadow-sm">
          Manual
        </div>
      )}

      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ background: '#64748b', width: '8px', height: '8px', borderRadius: '4px' }}
        id="bottom"
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        style={{ background: '#64748b', width: '8px', height: '8px', borderRadius: '4px' }}
        id="right"
      />
    </div>
  );
}
