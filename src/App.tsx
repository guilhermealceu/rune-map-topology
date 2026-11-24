import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Network, 
  Upload, 
  Plus, 
  Trash2, 
  Search, 
  FileCode, 
  FolderOpen, 
  Info, 
  Save, 
  Shield, 
  Globe, 
  Server, 
  Users, 
  RefreshCw, 
  Layers, 
  Radio, 
  Laptop, 
  Video, 
  Printer, 
  Link2, 
  Activity,
  Tag,
  CheckCircle,
  Database,
  ArrowRight,
  Download,
  Trash,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Settings,
  HelpCircle
} from 'lucide-react';
import { PfSenseConfig } from './types';
import { parsePfSenseXML, parseRuneXML, exportSiteToRuneXML } from './utils';
import { FACTORY_DEFAULT_XML } from './defaultXml';
import TopologyMap from './components/TopologyMap';

interface SiteCatalog {
  id: string;
  siteName: string;
  fileName: string;
  lastBackupDate: string;
  xmlContent?: string;
  isManual: boolean;
}

const DEFAULT_SITES_KEY = 'rune_topology_catalog_sites';

export default function App() {
  // --- Catalog States ---
  const [sites, setSites] = useState<SiteCatalog[]>(() => {
    const saved = localStorage.getItem(DEFAULT_SITES_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const migrated = parsed.map((s: any) => {
          return s;
        });
        return migrated;
      } catch (e) {
        console.error(e);
      }
    }
    // Default initial demonstration sites
    return [
      {
        id: 'exemplo_pfsense_matriz',
        siteName: 'RUNE-PROJECTS-MATRIZ',
        fileName: 'config-backup-20261206120000.xml',
        lastBackupDate: '12/06/2026 12:00',
        xmlContent: FACTORY_DEFAULT_XML,
        isManual: false
      }
    ];
  });

  const [activeSiteId, setActiveSiteId] = useState<string>(() => {
    return sites[0]?.id || '';
  });

  const [searchQuery, setSearchQuery] = useState('');
  
  // --- Active Site Setup State ---
  const activeSite = sites.find(s => s.id === activeSiteId) || null;
  const activeConfig = React.useMemo(() => {
    if (activeSite && activeSite.xmlContent) {
      try {
        return parsePfSenseXML(activeSite.xmlContent);
      } catch (e) {
        console.error("Erro ao analisar pfSense XML da sessão ativa:", e);
        return null;
      }
    }
    return null;
  }, [activeSite]);

  // --- Map Elements State (Saved dynamically per site) ---
  const [customNodes, setCustomNodes] = useState<any[]>([]);
  const [customEdges, setCustomEdges] = useState<any[]>([]);
  const [nodePositions, setNodePositions] = useState<{ [nodeId: string]: { x: number; y: number } }>({});

  // Inspectors selection
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<any | null>(null);

  // Premium custom notification system
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' | 'warning' } | null>(null);
  
  const triggerToast = useCallback((message: string, type: 'success' | 'info' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
  }, []);

  // Clear toast automatically
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Modals & Panels toggle
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [showAddSiteModal, setShowAddSiteModal] = useState(false);
  const [showStartWizardModal, setShowStartWizardModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);

  // Form inputs - Add New Manual Site
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteIsManual, setNewSiteIsManual] = useState(false);
  const [newSiteXmlFile, setNewSiteXmlFile] = useState<File | null>(null);

  // Form inputs - Add Custom Node
  const [customNodeName, setCustomNodeName] = useState('');
  const [customNodeType, setCustomNodeType] = useState<string>('switch');
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [typeSearchValue, setTypeSearchValue] = useState('Switch de Rede');
  const [customNodeIp, setCustomNodeIp] = useState('');
  const [customNodeMac, setCustomNodeMac] = useState('');
  const [customNodeModel, setCustomNodeModel] = useState('');
  const [customNodeVlan, setCustomNodeVlan] = useState('');
  const [customNodeDescr, setCustomNodeDescr] = useState('');

  // Form inputs - Selected Custom Node Inspector Editing
  const [inspectNodeLabel, setInspectNodeLabel] = useState('');
  const [inspectNodeIp, setInspectNodeIp] = useState('');
  const [inspectNodeMac, setInspectNodeMac] = useState('');
  const [inspectNodeModel, setInspectNodeModel] = useState('');
  const [inspectNodeVlan, setInspectNodeVlan] = useState('');
  const [inspectNodeDescr, setInspectNodeDescr] = useState('');

  // Form inputs - Selected Custom Edge Inspector Editing
  const [inspectEdgeLabel, setInspectEdgeLabel] = useState('');
  const [inspectEdgeMedia, setInspectEdgeMedia] = useState<'ethernet' | 'fiber' | 'wireless' | 'vpn' | 'virtual'>('ethernet');
  const [inspectEdgeColor, setInspectEdgeColor] = useState('#475569');

  // Input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const runeFileInputRef = useRef<HTMLInputElement>(null);

  // Save sites catalog inside localstorage on updates
  useEffect(() => {
    localStorage.setItem(DEFAULT_SITES_KEY, JSON.stringify(sites));
  }, [sites]);

  // Persists custom elements modifications back to localstorage immediately
  const persistActiveLayout = useCallback((nodes: any[], edges: any[], positions: { [id: string]: { x: number; y: number } }) => {
    if (!activeSiteId) return;
    localStorage.setItem(`rune_topology_layout_${activeSiteId}`, JSON.stringify({
      customNodes: nodes,
      customEdges: edges,
      nodePositions: positions
    }));
  }, [activeSiteId]);

  // Fetch / sync layout configuration states when active site shifts
  useEffect(() => {
    if (!activeSiteId) {
      setCustomNodes([]);
      setCustomEdges([]);
      setNodePositions({});
      setSelectedNode(null);
      setSelectedEdge(null);
      return;
    }

    const savedLayout = localStorage.getItem(`rune_topology_layout_${activeSiteId}`);
    if (savedLayout) {
      try {
        const layout = JSON.parse(savedLayout);
        setCustomNodes(layout.customNodes || []);
        setCustomEdges(layout.customEdges || []);
        setNodePositions(layout.nodePositions || {});
      } catch (err) {
        console.error("Erro carregando topologia customizada:", err);
        setCustomNodes([]);
        setCustomEdges([]);
        setNodePositions({});
      }
    } else {
      if (activeSiteId === 'exemplo_pfsense_matriz') {
        const demoNodes = [
          {
            id: 'demo-switch-core',
            type: 'customNetwork',
            position: { x: 350, y: 730 },
            data: {
              label: 'Switch Core Ubiquiti',
              type: 'switch',
              ip: '192.168.1.10',
              mac: 'fc:ec:da:11:22:33',
              model: 'USW-Enterprise-24',
              descr: 'Switch de Distribuição Core gigabit',
              isCustom: true
            }
          },
          {
            id: 'demo-ap-01',
            type: 'customNetwork',
            position: { x: 120, y: 920 },
            data: {
              label: 'Unifi AP-AC-Pro Escritório',
              type: 'ap',
              ip: '192.168.1.50',
              mac: 'fc:ec:da:22:33:44',
              model: 'UAP-AC-PRO',
              descr: 'Ponto de acesso sem fio setor administrativo',
              isCustom: true
            }
          },
          {
            id: 'demo-server',
            type: 'customNetwork',
            position: { x: 580, y: 920 },
            data: {
              label: 'Servidor Proxmox VE',
              type: 'server',
              ip: '192.168.1.200',
              mac: 'fc:ec:da:55:66:77',
              model: 'Dell PowerEdge R740',
              descr: 'Banco de dados ERP e serviços locais',
              isCustom: true
            }
          },
          {
            id: 'demo-camera',
            type: 'customNetwork',
            position: { x: 350, y: 920 },
            data: {
              label: 'Câmera IP CFTV Recepção',
              type: 'camera',
              ip: '192.168.1.180',
              mac: 'fc:ec:da:88:99:aa',
              model: 'VIP 1230',
              vlan: '10',
              descr: 'Gravação em tempo real',
              isCustom: true
            }
          }
        ];

        const demoEdges = [
          {
            id: 'e-demo-1',
            source: 'lan-lan',
            target: 'demo-switch-core',
            animated: true,
            style: { stroke: '#475569', strokeWidth: 2.5 },
            markerEnd: { type: 'arrowclosed', color: '#475569' },
            data: { label: 'Ligação Core', media: 'ethernet', color: '#475569' }
          },
          {
            id: 'e-demo-2',
            source: 'demo-switch-core',
            target: 'demo-ap-01',
            animated: true,
            style: { stroke: '#f97316', strokeWidth: 2.5, strokeDasharray: '6 6' },
            markerEnd: { type: 'arrowclosed', color: '#f97316' },
            data: { label: 'Wi-Fi AP', media: 'wireless', color: '#f97316' }
          },
          {
            id: 'e-demo-3',
            source: 'demo-switch-core',
            target: 'demo-server',
            animated: true,
            style: { stroke: '#4f46e5', strokeWidth: 2.5 },
            markerEnd: { type: 'arrowclosed', color: '#4f46e5' },
            data: { label: 'Links Servidor', media: 'ethernet', color: '#4f46e5' }
          },
          {
            id: 'e-demo-4',
            source: 'demo-switch-core',
            target: 'demo-camera',
            animated: true,
            style: { stroke: '#14b8a6', strokeWidth: 2.5 },
            markerEnd: { type: 'arrowclosed', color: '#14b8a6' },
            data: { label: 'CFTV Link', media: 'ethernet', color: '#14b8a6' }
          }
        ];

        const demoPositions = {
          'demo-switch-core': { x: 350, y: 730 },
          'demo-ap-01': { x: 120, y: 920 },
          'demo-server': { x: 580, y: 920 },
          'demo-camera': { x: 350, y: 920 }
        };

        setCustomNodes(demoNodes);
        setCustomEdges(demoEdges);
        setNodePositions(demoPositions);
        persistActiveLayout(demoNodes, demoEdges, demoPositions);
      } else {
        // Clear custom maps if none exist
        setCustomNodes([]);
        setCustomEdges([]);
        setNodePositions({});
      }
    }
    
    // Clear inspection panels
    setSelectedNode(null);
    setSelectedEdge(null);
  }, [activeSiteId, persistActiveLayout]);

  // Handles updating node positioning in real-time
  const handleNodeDragStop = useCallback((nodeId: string, position: { x: number; y: number }) => {
    setNodePositions(prev => {
      const updated = {
        ...prev,
        [nodeId]: position
      };
      persistActiveLayout(customNodes, customEdges, updated);
      return updated;
    });
  }, [customNodes, customEdges, persistActiveLayout]);

  // Handles raw React Flow node connecting logic
  const handleConnect = useCallback((connection: any) => {
    const newEdgeId = `e-custom-${Date.now()}`;
    const newEdgeStyle = {
      id: newEdgeId,
      source: connection.source,
      sourceHandle: connection.sourceHandle,
      target: connection.target,
      targetHandle: connection.targetHandle,
      animated: true,
      style: { stroke: '#475569', strokeWidth: 2.5 },
      markerEnd: {
        type: 'arrowclosed',
        color: '#475569',
      },
      data: {
        label: 'Ligação',
        media: 'ethernet',
        color: '#475569'
      }
    };
    
    setCustomEdges(prev => {
      const updated = [...prev, newEdgeStyle];
      persistActiveLayout(customNodes, updated, nodePositions);
      triggerToast("Nova conexão física de rede estabelecida!", "success");
      return updated;
    });
  }, [customNodes, nodePositions, persistActiveLayout]);

  // --- Sidebar search & catalogs mapping ---
  const filteredSites = sites.filter(s => 
    s.siteName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handler: Selecting target directory containing sub-backups
  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const xmlFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.name.endsWith('.xml')) {
        xmlFiles.push(file);
      }
    }

    if (xmlFiles.length === 0) {
      triggerToast("Nenhum backup .xml localizado na pasta selecionada ou subpastas.", "warning");
      return;
    }

    // Grouping backups based on direct parent subfolder names
    const grouped: { [folderName: string]: File[] } = {};

    for (const file of xmlFiles) {
      const pathParts = file.webkitRelativePath.split('/');
      let folderName = 'Outros Backups';
      if (pathParts.length > 1) {
        // Immediate parent subfolder is second to last
        folderName = pathParts[pathParts.length - 2];
      }
      
      if (!grouped[folderName]) {
        grouped[folderName] = [];
      }
      grouped[folderName].push(file);
    }

    // Helper: Parse or extract digital backup timestamp e.g. "config-backup-20261206093410.xml"
    const getFileTimestamp = (fileName: string, fileModified: number): number => {
      const match = fileName.match(/(\d{14})/);
      if (match) {
        const tsStr = match[1];
        try {
          const year = parseInt(tsStr.substring(0, 4), 10);
          const month = parseInt(tsStr.substring(4, 6), 10) - 1;
          const day = parseInt(tsStr.substring(6, 8), 10);
          const hour = parseInt(tsStr.substring(8, 10), 10);
          const minute = parseInt(tsStr.substring(10, 12), 10);
          const second = parseInt(tsStr.substring(12, 14), 10);
          return new Date(year, month, day, hour, minute, second).getTime();
        } catch (e) {
          return fileModified;
        }
      }
      return fileModified;
    };

    const newSitesBatch: SiteCatalog[] = [];

    for (const [folderName, filesInFolder] of Object.entries(grouped)) {
      // Sort sub-backups to find single most recent file
      const sortedFiles = [...filesInFolder].sort((a, b) => {
        const tsA = getFileTimestamp(a.name, a.lastModified);
        const tsB = getFileTimestamp(b.name, b.lastModified);
        return tsB - tsA; // recent first
      });

      const mostRecentFile = sortedFiles[0];

      // File parser thread reader
      const xmlString = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve(event.target?.result as string || '');
        };
        reader.readAsText(mostRecentFile);
      });

      const fileTimestamp = getFileTimestamp(mostRecentFile.name, mostRecentFile.lastModified);
      const dateStr = new Date(fileTimestamp).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      newSitesBatch.push({
        id: folderName.toLowerCase().replace(/[^a-z0-9]/g, '_') + `_${Date.now()}`,
        siteName: folderName,
        fileName: mostRecentFile.name,
        lastBackupDate: dateStr,
        xmlContent: xmlString,
        isManual: false
      });
    }

    // Append and keep unique site names or replace if duplicate names are detected
    setSites(prev => {
      const mergedSites = [...prev];
      newSitesBatch.forEach(newSite => {
        const existingIdx = mergedSites.findIndex(s => s.siteName === newSite.siteName);
        if (existingIdx !== -1) {
          // Update existing with newer backup details
          mergedSites[existingIdx] = newSite;
        } else {
          mergedSites.push(newSite);
        }
      });
      return mergedSites;
    });

    if (newSitesBatch.length > 0) {
      setActiveSiteId(newSitesBatch[0].id);
      triggerToast(`Parabéns! ${newSitesBatch.length} filiais/pastas carregadas com sucesso. Apenas o backup mais recente de cada filial foi selecionado.`, "success");
    }
  };

  // Handler: Individual direct XML files drop imports
  const handleSingleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const xmlString = event.target?.result as string;
      try {
        // Validate XML compatibility
        parsePfSenseXML(xmlString);
        
        const siteName = file.name.replace('.xml', '').toUpperCase();
        const dateStr = new Date(file.lastModified).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        const newSite: SiteCatalog = {
          id: `single_${siteName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
          siteName: siteName,
          fileName: file.name,
          lastBackupDate: dateStr,
          xmlContent: xmlString,
          isManual: false
        };

        setSites(prev => {
          const filtered = prev.filter(s => s.siteName !== siteName);
          return [newSite, ...filtered];
        });
        setActiveSiteId(newSite.id);
        setShowStartWizardModal(false);
      } catch (err) {
        console.error(err);
        triggerToast("Erro ao processar o XML. O arquivo não possui o formato ou tags básicas de configurações do pfSense.", "error");
      }
    };
    reader.readAsText(file);
  };

  // Handler: Import custom Rune Map Topology XML files
  const handleImportRuneXML = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const xmlString = event.target?.result as string;
      try {
        const parsed = parseRuneXML(xmlString);
        const siteId = `rune_${parsed.siteName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;

        const newSite: SiteCatalog = {
          id: siteId,
          siteName: parsed.siteName.toUpperCase(),
          fileName: file.name,
          lastBackupDate: parsed.lastBackupDate,
          xmlContent: parsed.xmlContent,
          isManual: parsed.isManual
        };

        localStorage.setItem(`rune_topology_layout_${siteId}`, JSON.stringify({
          customNodes: parsed.customNodes,
          customEdges: parsed.customEdges,
          nodePositions: parsed.nodePositions
        }));

        setSites(prev => {
          const filtered = prev.filter(s => s.siteName !== parsed.siteName.toUpperCase());
          return [newSite, ...filtered];
        });
        
        setActiveSiteId(siteId);
        setShowStartWizardModal(false);
        triggerToast(`Topologia "${parsed.siteName}" importada com sucesso do XML Rune Map!`, "success");
      } catch (err: any) {
        console.error(err);
        triggerToast(`Erro ao processar o XML do Rune Map: ${err.message || err}`, "error");
      }
    };
    reader.readAsText(file);
  };

  // Handler: Adding custom manual nodes to active map viewport
  const handleAddCustomNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customNodeName.trim()) return;

    const newNodeId = `custom-node-${Date.now()}`;
    const newNode = {
      id: newNodeId,
      type: 'customNetwork',
      position: { x: 500, y: 350 },
      data: {
        label: customNodeName,
        type: customNodeType,
        ip: customNodeIp || undefined,
        mac: customNodeMac || undefined,
        model: customNodeModel || undefined,
        vlan: customNodeVlan || undefined,
        descr: customNodeDescr || undefined,
        isCustom: true
      },
    };

    const updatedNodes = [...customNodes, newNode];
    setCustomNodes(updatedNodes);

    setNodePositions(prev => {
      const updatedPos = { ...prev, [newNodeId]: { x: 500, y: 350 } };
      persistActiveLayout(updatedNodes, customEdges, updatedPos);
      return updatedPos;
    });

    triggerToast(`Equipamento customizado "${customNodeName}" adicionado ao mapa!`, "success");

    // Reset inputs
    setCustomNodeName('');
    setCustomNodeIp('');
    setCustomNodeMac('');
    setCustomNodeModel('');
    setCustomNodeVlan('');
    setCustomNodeDescr('');
    setCustomNodeType('switch');
    setTypeSearchValue('Switch de Rede');
    setIsTypeDropdownOpen(false);
    setShowAddNodeModal(false);
  };

  // Handler: Manual site creation from scratch (no XML loaded)
  const handleAddManualSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteName.trim()) return;

    const siteId = `manual_${newSiteName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const dateStr = new Date().toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    if (newSiteIsManual) {
      const newSite: SiteCatalog = {
        id: siteId,
        siteName: newSiteName.toUpperCase(),
        fileName: 'Desenvolvimento manual do zero',
        lastBackupDate: dateStr,
        isManual: true
      };

      setSites(prev => [newSite, ...prev]);
      setActiveSiteId(siteId);
      setShowAddSiteModal(false);
      setNewSiteName('');
    } else {
      if (!newSiteXmlFile) {
        triggerToast("Por favor, selecione um arquivo pfSense XML para prosseguir.", "warning");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const xmlString = event.target?.result as string;
        try {
          parsePfSenseXML(xmlString);
          const newSite: SiteCatalog = {
            id: siteId,
            siteName: newSiteName.toUpperCase(),
            fileName: newSiteXmlFile.name,
            lastBackupDate: dateStr,
            xmlContent: xmlString,
            isManual: false
          };
          setSites(prev => [newSite, ...prev]);
          setActiveSiteId(siteId);
          setShowAddSiteModal(false);
          setNewSiteName('');
          setNewSiteXmlFile(null);
          triggerToast("Dispositivo pareado com sucesso!", "success");
        } catch (err) {
          triggerToast("O XML selecionado é inválido.", "error");
        }
      };
      reader.readAsText(newSiteXmlFile);
    }
  };

  // Sync edits from Custom Node inspector inputs back to customNodes list
  const handleSaveNodeInspectChanges = () => {
    if (!selectedNode) return;
    const nodeId = selectedNode.id;

    // Check if it is a custom node
    const isCustom = customNodes.some(n => n.id === nodeId);
    if (!isCustom) {
      triggerToast("Nós nativos do pfSense (XML) possuem metadados fixos que não podem ser alterados diretamente.", "warning");
      return;
    }

    setCustomNodes(prev => {
      const updated = prev.map(node => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              label: inspectNodeLabel || node.data.label,
              ip: inspectNodeIp || undefined,
              mac: inspectNodeMac || undefined,
              model: inspectNodeModel || undefined,
              vlan: inspectNodeVlan || undefined,
              descr: inspectNodeDescr || undefined
            }
          };
        }
        return node;
      });

      // Persist modifications
      persistActiveLayout(updated, customEdges, nodePositions);
      
      // Update local state selector to avoid UI mismatch
      setSelectedNode(curr => curr ? {
        ...curr,
        data: {
          ...curr.data,
          label: inspectNodeLabel,
          ip: inspectNodeIp || undefined,
          mac: inspectNodeMac || undefined,
          model: inspectNodeModel || undefined,
          vlan: inspectNodeVlan || undefined,
          descr: inspectNodeDescr || undefined
        }
      } : null);

      return updated;
    });
  };

  // Sync edits from Custom Edge inspector inputs back to customEdges list
  const handleSaveEdgeInspectChanges = () => {
    if (!selectedEdge) return;
    const edgeId = selectedEdge.id;

    setCustomEdges(prev => {
      const updated = prev.map(edge => {
        if (edge.id === edgeId) {
          let updatedStyle: any = { stroke: inspectEdgeColor, strokeWidth: 2.5 };
          let updatedAnimated = true;
          
          if (inspectEdgeMedia === 'fiber') {
            updatedStyle = { stroke: inspectEdgeColor || '#06b6d4', strokeWidth: 3.5 };
            updatedAnimated = false;
          } else if (inspectEdgeMedia === 'wireless') {
            updatedStyle = { stroke: inspectEdgeColor || '#f59e0b', strokeWidth: 2.5, strokeDasharray: '6 6' };
          } else if (inspectEdgeMedia === 'vpn') {
            updatedStyle = { stroke: inspectEdgeColor || '#6366f1', strokeWidth: 2.5, strokeDasharray: '10 4 animate' };
          } else if (inspectEdgeMedia === 'virtual') {
            updatedStyle = { stroke: inspectEdgeColor || '#94a3b8', strokeWidth: 1.5, strokeDasharray: '2 2' };
            updatedAnimated = false;
          }

          return {
            ...edge,
            animated: updatedAnimated,
            style: updatedStyle,
            markerEnd: {
              type: 'arrowclosed',
              color: inspectEdgeColor,
            },
            data: {
              label: inspectEdgeLabel,
              media: inspectEdgeMedia,
              color: inspectEdgeColor
            }
          };
        }
        return edge;
      });

      persistActiveLayout(customNodes, updated, nodePositions);

      // Update active select pointer properties
      setSelectedEdge(curr => curr ? {
        ...curr,
        data: {
          label: inspectEdgeLabel,
          media: inspectEdgeMedia,
          color: inspectEdgeColor
        }
      } : null);

      return updated;
    });
  };

  // Populate inspection panel inputs dynamically when selecting a node
  useEffect(() => {
    if (selectedNode) {
      setInspectNodeLabel(selectedNode.data?.label || '');
      setInspectNodeIp(selectedNode.data?.ip || '');
      setInspectNodeMac(selectedNode.data?.mac || '');
      setInspectNodeModel(selectedNode.data?.model || '');
      setInspectNodeVlan(selectedNode.data?.vlan || '');
      setInspectNodeDescr(selectedNode.data?.descr || '');
    }
  }, [selectedNode]);

  // Populate inspection panel inputs details when selecting an edge connection
  useEffect(() => {
    if (selectedEdge) {
      setInspectEdgeLabel(selectedEdge.data?.label || 'Link');
      setInspectEdgeMedia(selectedEdge.data?.media || 'ethernet');
      setInspectEdgeColor(selectedEdge.data?.color || '#475569');
    }
  }, [selectedEdge]);

  // Handler: Delete current custom node or custom edge
  const handleDeleteSelectedNode = () => {
    if (!selectedNode) return;
    const nodeId = selectedNode.id;

    if (!customNodes.some(n => n.id === nodeId)) {
      triggerToast("Equipamentos gerados pelo XML são fixos. Crie novos equipamentos manuais para ter total controle de exclusão!", "warning");
      return;
    }

    if (confirm("Deseja realmente remover este equipamento customizado?")) {
      const remainingNodes = customNodes.filter(n => n.id !== nodeId);
      const remainingEdges = customEdges.filter(e => e.source !== nodeId && e.target !== nodeId);
      
      setCustomNodes(remainingNodes);
      setCustomEdges(remainingEdges);
      
      setNodePositions(prev => {
        const copy = { ...prev };
        delete copy[nodeId];
        persistActiveLayout(remainingNodes, remainingEdges, copy);
        return copy;
      });
      setSelectedNode(null);
    }
  };

  const handleDeleteSelectedEdge = () => {
    if (!selectedEdge) return;
    
    // Check if edge is indeed a customizable link
    const isCustomEdge = customEdges.some(e => e.id === selectedEdge.id);
    if (!isCustomEdge) {
      triggerToast("Ligações redundantes e físicas do XML não podem ser desmontadas. Modifique suas portas de interface/gateway no pfSense para removê-las.", "warning");
      return;
    }

    if (confirm("Deseja desconectar este barramento da sua topologia de rede?")) {
      const remainingEdges = customEdges.filter(e => e.id !== selectedEdge.id);
      setCustomEdges(remainingEdges);
      persistActiveLayout(customNodes, remainingEdges, nodePositions);
      setSelectedEdge(null);
    }
  };

  // Clear all position variables and layouts of active site
  const handleResetLayout = () => {
    if (confirm("Deseja restaurar as posições padrão dos equipamentos? Isso organizará tudo de volta ao padrão estruturado.")) {
      setNodePositions({});
      persistActiveLayout(customNodes, customEdges, {});
      // Refresh component
      const activeIdTemp = activeSiteId;
      setActiveSiteId('');
      setTimeout(() => setActiveSiteId(activeIdTemp), 50);
    }
  };

  // Completely erase site catalog
  const handleDeleteActiveSite = () => {
    if (!activeSiteId) return;
    
    const targetSiteName = activeSite?.siteName || "este site";
    
    if (confirm(`Tem certeza que deseja apagar permanentemente o site "${targetSiteName}" do seu catálogo?`)) {
      const targetId = activeSiteId;
      
      setSites(prev => {
        const remaining = prev.filter(s => s.id !== targetId);
        if (remaining.length === 0) {
          setActiveSiteId('');
          return [];
        } else {
          setActiveSiteId(remaining[0].id);
          return remaining;
        }
      });
      
      localStorage.removeItem(`rune_topology_layout_${targetId}`);
      triggerToast(`Topologia "${targetSiteName}" excluída com sucesso!`, "success");
    }
  };

  // Download topology as Rune Map XML backup
  const handleExportRuneXML = () => {
    if (!activeSite) return;
    
    try {
      const xmlString = exportSiteToRuneXML(
        activeSite.siteName,
        activeSite.isManual,
        activeSite.lastBackupDate,
        activeSite.xmlContent,
        customNodes,
        customEdges,
        nodePositions
      );
      
      const blob = new Blob([xmlString], { type: 'text/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeSite.siteName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_runemap.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      triggerToast("Erro ao exportar a topologia em formato XML.", "error");
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafb] text-slate-800 font-sans flex flex-col" id="rune_app_wrapper">
      
      {/* Top polished header bar */}
      <header className="bg-white border-b border-slate-200/50 py-3 px-6 shrink-0 flex items-center justify-between z-[100] relative" id="app_header">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 text-white p-2 rounded-xl flex items-center justify-center shadow-md shrink-0">
              <Network size={22} className="stroke-[2.5]" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5 leading-none">
                Rune Map <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-lg">Topology</span>
              </h1>
              <p className="text-[9px] text-slate-400 font-bold tracking-wider uppercase mt-1">Diagramador Inteligente de Redes</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Main hidden file and folder input selectors */}
          <input 
            type="file" 
            ref={folderInputRef}
            onChange={handleFolderSelect}
            className="hidden" 
            id="folder_import_input"
            {...({
              webkitdirectory: "",
              directory: "",
              multiple: true
            } as any)}
          />
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleSingleImport}
            accept=".xml"
            className="hidden" 
            id="single_import_input"
          />
          <input 
            type="file" 
            ref={runeFileInputRef}
            onChange={handleImportRuneXML}
            accept=".xml"
            className="hidden" 
            id="rune_import_input"
          />

          {/* Icon Button 1: Start New Wizard (Nova Topologia) */}
          <div className="relative group">
            <button 
              onClick={() => setShowStartWizardModal(true)}
              className="p-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 text-white rounded-xl shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer flex items-center justify-center border border-blue-700"
              id="start_new_topology_wizard_btn"
            >
              <Upload size={16} className="stroke-[2.5]" />
            </button>
            <div className="absolute top-12 right-0 hidden group-hover:flex flex-col gap-0.5 bg-slate-900 border border-slate-800 text-white p-2.5 rounded-xl shadow-2xl z-[99999] pointer-events-none w-52 leading-tight">
              <div className="absolute -top-1 right-3.5 w-2 h-2 bg-slate-900 border-t border-l border-slate-800 rotate-45" />
              <p className="text-[10px] font-black tracking-wide text-white uppercase flex items-center gap-1">Nova Topologia</p>
              <p className="text-[9px] text-slate-400 font-medium whitespace-normal mt-0.5">Importe backups pfSense, diretórios inteiros ou arquivos XML Rune Map.</p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200/80 mx-1" />

          {/* Icon Button 2: Add Custom Equipment */}
          <div className="relative group">
            <button 
              onClick={() => setShowAddNodeModal(true)}
              className="p-2.5 bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center"
              id="add_equipment_btn"
            >
              <Plus size={16} className="stroke-[2.5]" />
            </button>
            <div className="absolute top-12 right-0 hidden group-hover:flex flex-col gap-0.5 bg-slate-900 border border-slate-800 text-white p-2.5 rounded-xl shadow-2xl z-[99999] pointer-events-none w-52 leading-tight">
              <div className="absolute -top-1 right-3.5 w-2 h-2 bg-slate-900 border-t border-l border-slate-800 rotate-45" />
              <p className="text-[10px] font-black tracking-wide text-white uppercase flex items-center gap-1">Add Equipamento</p>
              <p className="text-[9px] text-slate-400 font-medium whitespace-normal mt-0.5">Adicione switches, access points, servidores, antenas ou câmeras no diagrama.</p>
            </div>
          </div>

          {/* Icon Button 3: Reset Layout Positions */}
          <div className="relative group">
            <button 
              onClick={handleResetLayout}
              className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center"
              id="reset_positions_btn"
            >
              <RefreshCw size={16} />
            </button>
            <div className="absolute top-12 right-0 hidden group-hover:flex flex-col gap-0.5 bg-slate-900 border border-slate-800 text-white p-2.5 rounded-xl shadow-2xl z-[99999] pointer-events-none w-52 leading-tight">
              <div className="absolute -top-1 right-3.5 w-2 h-2 bg-slate-900 border-t border-l border-slate-800 rotate-45" />
              <p className="text-[10px] font-black tracking-wide text-white uppercase flex items-center gap-1">Reajustar Layout</p>
              <p className="text-[9px] text-slate-400 font-medium whitespace-normal mt-0.5">Distribuir e auto-organizar geograficamente os equipamentos na tela.</p>
            </div>
          </div>

          {/* Icon Button 4: Export Backup XML */}
          <div className="relative group">
            <button 
              onClick={handleExportRuneXML}
              className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center shadow-sm"
              id="export_runexml_btn"
            >
              <Download size={16} />
            </button>
            <div className="absolute top-12 right-0 hidden group-hover:flex flex-col gap-0.5 bg-slate-900 border border-slate-800 text-white p-2.5 rounded-xl shadow-2xl z-[99999] pointer-events-none w-52 leading-tight">
              <div className="absolute -top-1 right-3.5 w-2 h-2 bg-slate-900 border-t border-l border-slate-800 rotate-45" />
              <p className="text-[10px] font-black tracking-wide text-white uppercase flex items-center gap-1">Exportar XML Rune</p>
              <p className="text-[9px] text-slate-400 font-medium whitespace-normal mt-0.5">Salvar topologia atual com todas as posições dos switches e links manuais.</p>
            </div>
          </div>

          {/* Icon Button 5: Delete Site Catalog Entry */}
          <div className="relative group">
            <button 
              onClick={handleDeleteActiveSite}
              className="p-2.5 bg-white border border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center shadow-sm"
              id="delete_site_btn"
            >
              <Trash2 size={16} />
            </button>
            <div className="absolute top-12 right-0 hidden group-hover:flex flex-col gap-0.5 bg-slate-900 border border-slate-800 text-white p-2.5 rounded-xl shadow-2xl z-[99999] pointer-events-none w-52 leading-tight">
              <div className="absolute -top-1 right-3.5 w-2 h-2 bg-slate-900 border-t border-l border-slate-800 rotate-45" />
              <p className="text-[10px] font-black tracking-wide text-rose-400 uppercase flex items-center gap-1">
                Remover Instalação
              </p>
              <p className="text-[9px] text-slate-400 font-medium whitespace-normal mt-0.5">
                Excluir permanentemente este backup/filial do catálogo local.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main app panel */}
      <div className="flex-1 flex overflow-hidden relative" id="layout_workspace">
        
        {/* Left catalog sidebar */}
        <aside 
          className={`bg-white border-r border-slate-200/50 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'w-0 overflow-hidden border-r-0' : 'w-76 shrink-0'}`}
          id="aside_site_catalog"
        >
          {/* Search box */}
          <div className="p-4 border-b border-slate-100 flex flex-col gap-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input 
                type="text" 
                placeholder="Buscar filiais..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 pl-9 pr-3 py-1.5 rounded-xl text-xs focus:outline-none focus:border-slate-400 font-medium"
                id="site_search_input"
              />
            </div>
            
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
              <span>Filiais / Empresas ({filteredSites.length})</span>
              <span className="text-[8px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded">LOCAL</span>
            </div>
          </div>

          {/* Catalog list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
            {filteredSites.length === 0 ? (
              <div className="p-6 text-center text-slate-400 flex flex-col items-center gap-2">
                <HelpCircle size={28} className="stroke-[1.5] text-slate-300" />
                <p className="text-xs font-medium">Nenhum site localizado.</p>
                <span className="text-[10px] text-slate-400">Importe arquivos .xml individuais ou selecione uma pasta para auto-agrupar.</span>
              </div>
            ) : (
              filteredSites.map((site) => {
                const isActive = site.id === activeSiteId;
                return (
                  <button
                    key={site.id}
                    onClick={() => setActiveSiteId(site.id)}
                    className={`w-full text-left p-3 rounded-2xl flex items-start gap-2.5 transition-all outline-none border cursor-pointer ${
                      isActive 
                        ? 'bg-slate-900 border-slate-950 text-white shadow-md shadow-slate-900/10' 
                        : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200 text-slate-700'
                    }`}
                    id={`site_item_${site.id}`}
                  >
                    <div className={`p-1.5 rounded-xl shrink-0 ${isActive ? 'bg-slate-800 text-blue-400' : 'bg-slate-100 text-slate-500'}`}>
                      {site.isManual ? <Laptop size={14} /> : <Shield size={14} />}
                    </div>
                    <div className="overflow-hidden flex-1 leading-tight">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs truncate uppercase tracking-tight block flex-1">{site.siteName}</span>
                        {site.isManual && (
                          <span className="text-[8px] px-1 py-0.2 bg-emerald-100 text-emerald-700 font-mono rounded font-bold uppercase shrink-0">Manual</span>
                        )}
                      </div>
                      <p className={`text-[9px] mt-1 font-mono truncate ${isActive ? 'text-slate-400' : 'text-slate-400'}`} title={site.fileName}>
                        {site.fileName}
                      </p>
                      
                      {/* Sub-backup formatted date label */}
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className={`text-[8px] font-semibold ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                          Atua: {site.lastBackupDate}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 rounded-b-2xl">
            <p className="font-semibold flex items-center gap-1.5 text-slate-600 mb-1">
              <Info size={12} className="text-blue-500 shrink-0" /> Audite sua Infraestrutura
            </p>
            Mantenha seus backups de pfSense salvos localmente no navegador! Arraste os equipamentos para criar o diagrama ideal de switches e canais do seu cliente.
            <div className="mt-3.5 pt-3 border-t border-slate-200/50 flex flex-col gap-0.5" id="rune_projects_seo_footer">
              <span className="text-[9px] text-slate-400">
                Desenvolvido por{' '}
                <a 
                  href="https://www.runeprojects.com.br/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-600 hover:text-blue-700 hover:underline font-extrabold"
                >
                  Rune Projects
                </a>
              </span>
              <span className="text-[8px] text-slate-400 font-semibold uppercase tracking-wider font-sans">by Guilherme Dill</span>
            </div>
          </div>
        </aside>

        {/* Center diagram container */}
        <main className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden min-w-0" id="main_diagram_canvas_wrapper">

          {/* Interactive Topology Board */}
          <div className="flex-1 min-h-[400px] relative">
            
            <TopologyMap 
              config={activeConfig || undefined}
              customNodes={customNodes}
              customEdges={customEdges}
              nodePositions={nodePositions}
              onNodeDragStop={handleNodeDragStop}
              onConnect={handleConnect}
              onSelectNode={setSelectedNode}
              onSelectEdge={setSelectedEdge}
              selectedNodeId={selectedNode?.id || null}
              selectedEdgeId={selectedEdge?.id || null}
            />
          </div>
        </main>

        {/* Right Details inspector sidebar */}
        <aside 
          className={`bg-white border-l border-slate-200/50 overflow-y-auto shrink-0 flex flex-col transition-all duration-300 ${rightSidebarCollapsed ? 'w-0 p-0 border-l-0 overflow-hidden' : 'w-80 p-4 space-y-4'}`} 
          id="details_inspector_aside"
        >
          
          {selectedNode ? (
            /* Selected Node Inspector View */
            <div className="space-y-4 leading-tight">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 px-2 bg-slate-900 text-white rounded text-[10px] font-mono">EQUIP</div>
                  <h3 className="font-extrabold text-sm text-slate-800">Inspecionar Item</h3>
                </div>
                <button 
                  onClick={() => { setSelectedNode(null); }}
                  className="text-xs text-slate-400 hover:text-slate-800"
                >
                  Fechar
                </button>
              </div>

              {/* Node Static Details parsed */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-2">
                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Identificação Geral</span>
                <div>
                  <p className="text-xs font-bold text-slate-800">{selectedNode.data?.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{selectedNode.data?.descr || 'Sem descrição cadastrada.'}</p>
                </div>
                {selectedNode.data?.ip && (
                  <div className="pt-2 border-t border-slate-100 flex justify-between font-mono text-[10px] text-slate-600">
                    <span>IP Mapeado:</span>
                    <span className="font-bold">{selectedNode.data.ip}</span>
                  </div>
                )}
                {selectedNode.data?.mac && (
                  <div className="flex justify-between font-mono text-[10px] text-slate-600">
                    <span>MAC:</span>
                    <span>{selectedNode.data.mac}</span>
                  </div>
                )}
                {selectedNode.data?.model && (
                  <div className="flex justify-between text-[10px] text-slate-600">
                    <span>Modelo/Fabricante:</span>
                    <span className="font-semibold">{selectedNode.data.model}</span>
                  </div>
                )}
                {selectedNode.data?.vlan && (
                  <div className="flex justify-between text-[10px] text-slate-600">
                    <span>VLAN nativa:</span>
                    <span className="bg-purple-100 text-purple-700 px-1 py-0.2 rounded font-mono font-bold text-[9px]">VLAN {selectedNode.data.vlan}</span>
                  </div>
                )}
              </div>

              {/* Editable Fields (Only if custom manual equipment) */}
              {selectedNode.data?.isCustom ? (
                <div className="space-y-3 pt-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block pb-1 border-b border-dashed border-slate-100">Editar Equipamento Customizado</span>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500">Nome de Exibição</label>
                    <input 
                      type="text" 
                      value={inspectNodeLabel}
                      onChange={(e) => setInspectNodeLabel(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500">Endereço IP</label>
                    <input 
                      type="text" 
                      placeholder="Ex: 192.168.10.250"
                      value={inspectNodeIp}
                      onChange={(e) => setInspectNodeIp(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500">Endereço MAC</label>
                    <input 
                      type="text" 
                      placeholder="Ex: a8:5e:45:12:ef:22"
                      value={inspectNodeMac}
                      onChange={(e) => setInspectNodeMac(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500">Modelo do Aparelho</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Ubiquiti Lite AP GPS"
                      value={inspectNodeModel}
                      onChange={(e) => setInspectNodeModel(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500">VLAN Vinculada</label>
                    <input 
                      type="text" 
                      placeholder="Ex: 100"
                      value={inspectNodeVlan}
                      onChange={(e) => setInspectNodeVlan(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500">Anotações / Descrição</label>
                    <textarea 
                      placeholder="Anotações internas sobre as conexões deste dispositivo..."
                      rows={3}
                      value={inspectNodeDescr}
                      onChange={(e) => setInspectNodeDescr(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium"
                    />
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={handleSaveNodeInspectChanges}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
                    >
                      <Save size={14} /> Salvar
                    </button>
                    <button
                      onClick={handleDeleteSelectedNode}
                      className="px-3 py-2 border border-rose-200 text-rose-600 bg-rose-50/50 hover:bg-rose-50 rounded-xl text-xs font-semibold hover:border-rose-300 transition-all"
                      title="Excluir equipamento"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-blue-50/80 text-blue-800 border border-blue-100 rounded-2xl text-[10px] leading-relaxed">
                  📢 <strong>Informações do pfSense (Estático):</strong> Este nó foi autogerado a partir dos parâmetros de XML carregados. Você pode arrastá-lo livremente para remodelar os layouts da topologia, mas as configurações de rede fixas permanecem idênticas ao firewall de hardware.
                </div>
              )}
            </div>
          ) : selectedEdge ? (
            /* Selected Link Inspector View */
            <div className="space-y-4 leading-tight">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 px-2 bg-blue-600 text-white rounded text-[10px] font-mono">CONEXÃO</div>
                  <h3 className="font-extrabold text-sm text-slate-800">Mapear Conexão</h3>
                </div>
                <button 
                  onClick={() => { setSelectedEdge(null); }}
                  className="text-xs text-slate-400 hover:text-slate-800"
                >
                  Fechar
                </button>
              </div>

              {/* Editable connection link detail */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500">Nome / Identificação da Rota</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Uplink Fibra, Tronco VLAN 20"
                    value={inspectEdgeLabel}
                    onChange={(e) => setInspectEdgeLabel(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500">Meio de Transmissão</label>
                  <select 
                    value={inspectEdgeMedia}
                    onChange={(e) => setInspectEdgeMedia(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold"
                  >
                    <option value="ethernet">Cabo de Rede UTP (Metálico)</option>
                    <option value="fiber">Fibra Óptica (Uplink)</option>
                    <option value="wireless">Rádio / Sem Fio (PTP)</option>
                    <option value="vpn">Túnel VPN / IPsec redundante</option>
                    <option value="virtual">Interligação Virtual / VLAN</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500">Cor Representativa no Diagrama</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={inspectEdgeColor}
                      onChange={(e) => setInspectEdgeColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 overflow-hidden bg-transparent shrink-0"
                    />
                    <input 
                      type="text" 
                      value={inspectEdgeColor}
                      onChange={(e) => setInspectEdgeColor(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    onClick={handleSaveEdgeInspectChanges}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    <Save size={14} /> Atualizar Link
                  </button>
                  <button
                    onClick={handleDeleteSelectedEdge}
                    className="px-3 py-2 border border-rose-200 text-rose-600 bg-rose-50/50 hover:bg-rose-50 rounded-xl text-xs font-semibold"
                    title="Excluir conexão"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* General Site XML Static Metadata Audit view */
            <div className="space-y-4 text-slate-700 leading-tight">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-black text-sm text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                  <Activity size={16} className="text-emerald-500 shrink-0 animate-pulse" /> Auditoria Relatório
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Metadados da Filial Atual</p>
              </div>

              {activeConfig ? (
                <>
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/40 space-y-2.5">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Especificações Principais</span>
                    
                    <div className="text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-400">DNS Overwrite:</span>
                        <span className="font-semibold text-slate-700">{activeConfig.system.dnsallowoverride ? 'Ativo' : 'Desativado'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Timezone:</span>
                        <span className="font-semibold text-slate-700 font-mono text-[11px]">{activeConfig.system.timezone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">IPv6 Liberado:</span>
                        <span className="font-semibold text-slate-700">{activeConfig.system.ipv6allow ? 'Permitido' : 'Bloqueado'}</span>
                      </div>
                    </div>
                  </div>

                  {/* DHCP server & static maps listed */}
                  <div className="space-y-2 text-xs">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Servidores DHCP</span>
                    {Object.entries(activeConfig.dhcpd).length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">Nenhum pool DHCP listado no XML.</p>
                    ) : (
                      Object.entries(activeConfig.dhcpd).map(([ifName, dhcp]: any) => {
                        if (!dhcp.enable) return null;
                        return (
                          <div key={ifName} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl leading-relaxed">
                            <p className="font-extrabold text-[10px] text-slate-700 uppercase">Pool DHCP: {ifName}</p>
                            <span className="text-[9px] text-slate-400 font-mono block">Range: {dhcp.range.from} {`->`} {dhcp.range.to}</span>
                            {dhcp.staticmap && dhcp.staticmap.length > 0 && (
                              <div className="mt-1.5 pt-1.5 border-t border-slate-100/50">
                                <span className="text-[8px] uppercase font-bold text-slate-500 block">IPs Fixos Estáticos ({dhcp.staticmap.length})</span>
                                <div className="max-h-20 overflow-y-auto space-y-0.5 mt-1 pr-1 truncate text-[9px] font-mono whitespace-nowrap text-slate-600">
                                  {dhcp.staticmap.map((sm: any, idx: number) => (
                                    <div key={idx} className="flex justify-between gap-1">
                                      <span className="truncate max-w-[80px]" title={sm.hostname}>{sm.hostname || 'sem-nome'}</span>
                                      <span>{sm.ipaddr}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Zabbix agent diagnostic review */}
                  {activeConfig.zabbix?.agent?.enabled && (
                    <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-2xl text-xs space-y-1">
                      <div className="flex items-center gap-1 text-emerald-800 font-bold text-[10px] uppercase">
                        <CheckCircle size={12} /> Zabbix Monitoramento Ativo
                      </div>
                      <p className="text-[9px] text-emerald-600 font-mono">Server: {activeConfig.zabbix.agent.server}</p>
                      <p className="text-[9px] text-emerald-600 font-mono">Listen port: {activeConfig.zabbix.agent.listenport}</p>
                    </div>
                  )}

                  {/* Count indices metrics labels */}
                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-xl font-bold font-mono text-slate-800">{(activeConfig.vlans || []).length}</span>
                      <p className="text-[8px] font-bold uppercase text-slate-400 mt-0.5">VLANs</p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-xl font-bold font-mono text-slate-800">{activeConfig.interfaces.length}</span>
                      <p className="text-[8px] font-bold uppercase text-slate-400 mt-0.5">Interfaces</p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-xl font-bold font-mono text-slate-800">{(activeConfig.filter?.rule || []).length}</span>
                      <p className="text-[8px] font-bold uppercase text-slate-400 mt-0.5 font-sans">Regras de FW</p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-xl font-bold font-mono text-slate-800">{activeConfig.gateways?.gateway_item?.length || 0}</span>
                      <p className="text-[8px] font-bold uppercase text-slate-400 mt-0.5">Gateways</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-6 text-center text-slate-400 flex flex-col items-center gap-1">
                  <Database size={24} className="text-slate-300" />
                  <p className="text-xs font-semibold">Diagrama puramente Manual</p>
                  <p className="text-[10px] text-slate-400 leading-normal max-w-[180px] mx-auto">Este site iniciou do zero e não possui configuração pfSense atrelada. Adicione seus switches e rádios!</p>
                </div>
              )}
            </div>
          )}

        </aside>

        {/* Toggle Left Sidebar Button - Attached to the edge of the sidebar */}
        <button 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute z-40 w-5 h-14 bg-white hover:bg-slate-50 border-y border-r border-slate-200/80 hover:border-slate-300 rounded-r-xl flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all cursor-pointer shadow-[2px_2px_5px_rgba(0,0,0,0.06)] group"
          style={{ 
            left: sidebarCollapsed ? '0px' : '304px', 
            top: '48px',
            transition: 'left 300ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          id="toggle_sidebar_handle"
          title={sidebarCollapsed ? "Mostrar filiais" : "Ocultar filiais"}
        >
          {sidebarCollapsed ? <ChevronRight size={14} className="stroke-[2.5]" /> : <ChevronLeft size={14} className="stroke-[2.5]" />}
        </button>

        {/* Toggle Right Sidebar Button - Attached to the edge of the right sidebar */}
        <button 
          onClick={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
          className="absolute z-40 w-5 h-14 bg-white hover:bg-slate-50 border-y border-l border-slate-200/80 hover:border-slate-300 rounded-l-xl flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all cursor-pointer shadow-[-2px_2px_5px_rgba(0,0,0,0.06)] group"
          style={{ 
            right: rightSidebarCollapsed ? '0px' : '320px', 
            top: '48px',
            transition: 'right 300ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          id="toggle_right_sidebar_handle"
          title={rightSidebarCollapsed ? "Mostrar auditoria" : "Ocultar auditoria"}
        >
          {rightSidebarCollapsed ? <ChevronLeft size={14} className="stroke-[2.5]" /> : <ChevronRight size={14} className="stroke-[2.5]" />}
        </button>

      </div>

      {/* MODAL 1: ADD CUSTOM NODE */}
      {showAddNodeModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="add_node_modal_backdrop">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-slate-150 animate-scale-up" id="add_node_modal_box">
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                  <Network size={20} className="stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="font-black text-sm tracking-tight">Adicionar Novo Equipamento</h4>
                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mt-0.5">Defina os parâmetros técnicos de seu novo ativo</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddNodeModal(false)}
                className="text-slate-400 hover:text-white text-xs font-semibold hover:bg-white/10 px-3 py-1.5 rounded-lg transition-all outline-none cursor-pointer"
              >
                Voltar
              </button>
            </div>

            <form onSubmit={handleAddCustomNode} className="p-6 space-y-4 text-xs font-medium text-slate-700">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400">Nome do Aparelho *</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: Switch Core 24p, Rádio PTP Matriz"
                  value={customNodeName}
                  onChange={(e) => setCustomNodeName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 relative" id="custom_type_dropdown_wrapper">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Tipo de Equipamento</label>
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="Pesquise ou digite outro..."
                      value={typeSearchValue}
                      onFocus={() => setIsTypeDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setIsTypeDropdownOpen(false), 250)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTypeSearchValue(val);
                        setIsTypeDropdownOpen(true);
                        
                        const found = [
                          { id: 'switch', label: 'Switch de Rede' },
                          { id: 'antenna', label: 'Antena PTP (Rádio)' },
                          { id: 'ap', label: 'Access Point (AP)' },
                          { id: 'server', label: 'Servidor Local' },
                          { id: 'host', label: 'Dispositivo Genérico' },
                          { id: 'camera', label: 'Câmera IP' },
                          { id: 'printer', label: 'Impressora de Rede' },
                          { id: 'vpn', label: 'Túnel IPsec' }
                        ].find(opt => opt.label.toLowerCase() === val.toLowerCase());
                        
                        if (found) {
                          setCustomNodeType(found.id);
                        } else {
                          setCustomNodeType(val || 'other');
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-8 text-xs font-semibold focus:border-blue-500 focus:bg-white transition-all outline-none"
                    />
                    <button 
                      type="button"
                      onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer outline-none"
                    >
                      <ChevronDown size={14} className={`transition-transform duration-200 ${isTypeDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {isTypeDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto" id="type_dropdown_list">
                      {[
                        { id: 'switch', label: 'Switch de Rede' },
                        { id: 'antenna', label: 'Antena PTP (Rádio)' },
                        { id: 'ap', label: 'Access Point (AP)' },
                        { id: 'server', label: 'Servidor Local' },
                        { id: 'host', label: 'Dispositivo Genérico' },
                        { id: 'camera', label: 'Câmera IP' },
                        { id: 'printer', label: 'Impressora de Rede' },
                        { id: 'vpn', label: 'Túnel IPsec' }
                      ].filter(opt => opt.label.toLowerCase().includes(typeSearchValue.toLowerCase())).map(option => (
                        <button
                          key={option.id}
                          type="button"
                          onMouseDown={() => {
                            setTypeSearchValue(option.label);
                            setCustomNodeType(option.id);
                            setIsTypeDropdownOpen(false);
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-blue-50 text-[11px] font-semibold text-slate-700 flex items-center justify-between cursor-pointer transition-all border-b border-slate-50 last:border-0"
                        >
                          <span>{option.label}</span>
                          <span className="text-[9px] text-slate-400 font-normal uppercase bg-slate-100 px-1.5 py-0.5 rounded-md">Padrão</span>
                        </button>
                      ))}
                      
                      {/* Opção se for um termo customizado digitado */}
                      {typeSearchValue.trim() && ![
                        'switch de rede', 'antena ptp (rádio)', 'access point (ap)', 'servidor local', 'dispositivo genérico', 'câmera ip', 'impressora de rede', 'túnel ipsec'
                      ].includes(typeSearchValue.toLowerCase()) && (
                        <button
                          type="button"
                          onMouseDown={() => {
                            setCustomNodeType(typeSearchValue);
                            setIsTypeDropdownOpen(false);
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-indigo-50 text-[11px] font-bold text-indigo-600 flex items-center justify-between border-t border-dashed border-indigo-100 cursor-pointer bg-indigo-50/10"
                        >
                          <span className="truncate">➕ Usar "{typeSearchValue}"</span>
                          <span className="text-[9px] text-indigo-500 font-bold uppercase bg-indigo-50 px-1.5 py-0.5 rounded-md select-none shrink-0 ml-1">Customizado</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">VLAN Vinculada</label>
                  <input 
                    type="text"
                    placeholder="Ex: 50 ou Geral"
                    value={customNodeVlan}
                    onChange={(e) => setCustomNodeVlan(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Endereço IP</label>
                  <input 
                    type="text"
                    placeholder="Ex: 192.168.1.10"
                    value={customNodeIp}
                    onChange={(e) => setCustomNodeIp(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Endereço MAC</label>
                  <input 
                    type="text"
                    placeholder="Ex: e4:5c:01:2b:88:fa"
                    value={customNodeMac}
                    onChange={(e) => setCustomNodeMac(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400">Modelo do Equipamento</label>
                <input 
                  type="text"
                  placeholder="Ex: MikroTik CRS312, Ubiquiti Rocket M5"
                  value={customNodeModel}
                  onChange={(e) => setCustomNodeModel(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400">Breve Anotação / Descrição</label>
                <input 
                  type="text"
                  placeholder="Ex: Ligado na porta igc1 do pfSense"
                  value={customNodeDescr}
                  onChange={(e) => setCustomNodeDescr(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddNodeModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold select-none cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/15 cursor-pointer"
                >
                  Adicionar à Topologia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD EMPTY SITE OR MANUAL XML DESIGN */}
      {showAddSiteModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50" id="add_site_modal_backdrop">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-150" id="add_site_modal_box">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <span className="font-extrabold text-sm tracking-tight flex items-center gap-1.5">
                <Plus size={16} /> Cadastrar Nova Filial / Organização
              </span>
              <button onClick={() => setShowAddSiteModal(false)} className="text-slate-400 hover:text-white text-xs outline-none">
                Fechar
              </button>
            </div>

            <form onSubmit={handleAddManualSite} className="p-6 space-y-4 text-xs font-medium text-slate-700">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400">Nome da Filial / Cliente *</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: EMPRESA-FILIAL-PFSENSE"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs uppercase"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Método de Criação</label>
                
                <label className="flex items-center gap-2 cursor-pointer py-1 text-slate-600">
                  <input 
                    type="radio" 
                    checked={newSiteIsManual}
                    onChange={() => setNewSiteIsManual(true)}
                    className="accent-slate-900 w-4 h-4"
                  />
                  <div>
                    <p className="font-bold text-slate-800 text-[11px]">Desenhar do zero (Diagramador Puramente Manual)</p>
                    <p className="text-[9px] text-slate-400 leading-tight">Começa com o quadro em branco para você adicionar switches, antenas, etc.</p>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer py-1 text-slate-600">
                  <input 
                    type="radio" 
                    checked={!newSiteIsManual}
                    onChange={() => setNewSiteIsManual(false)}
                    className="accent-slate-900 w-4 h-4"
                  />
                  <div>
                    <p className="font-bold text-slate-800 text-[11px]">Carregar pfSense XML para gerar Roteador principal</p>
                    <p className="text-[9px] text-slate-400 leading-tight">Gera automaticamente as portas físicas, VLANs e gateway de internet para esta filial.</p>
                  </div>
                </label>
              </div>

              {!newSiteIsManual && (
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Arquivo pfSense XML (.xml)</label>
                  <input 
                    type="file"
                    accept=".xml"
                    onChange={(e) => setNewSiteXmlFile(e.target.files?.[0] || null)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddSiteModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md"
                >
                  Confirmar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL 3: RUNE MAP TOPOLOGY START WIZARD */}
      {showStartWizardModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all" id="start_wizard_modal_backdrop">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200" id="start_wizard_modal_box">
            
            {/* Header */}
            <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 text-white p-2 rounded-xl">
                  <Network size={20} className="stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white tracking-tight">Rune Map Topology</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Assistente de Configuração de Redes</p>
                </div>
              </div>
              <button 
                onClick={() => setShowStartWizardModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold transition-all px-3 py-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                Fechar
              </button>
            </div>

            {/* Content */}
            <div className="p-8 space-y-6">
              <div className="text-center space-y-1.5">
                <h4 className="text-lg font-extrabold text-slate-900 leading-tight">Como você deseja iniciar seu mapa de rede?</h4>
                <p className="text-xs text-slate-500">Selecione uma das opções abaixo para começar a modelar e documentar seus diagramas de ativos.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Opção 1: Criar um Novo Mapa de Rede (Diagrama Manual) */}
                <button 
                  onClick={() => {
                    setShowStartWizardModal(false);
                    setShowAddSiteModal(true);
                    setNewSiteIsManual(true);
                  }}
                  className="group text-left p-5 rounded-2xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/25 hover:shadow-md transition-all flex items-start gap-4 cursor-pointer outline-none"
                >
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-100 transition-all shrink-0">
                    <Plus size={20} className="stroke-[2.5]" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-xs text-slate-900 group-hover:text-blue-700 transition-all">Criar um novo mapa de rede</h5>
                    <p className="text-[10px] text-slate-500 leading-normal">Comece com um quadro em branco e desenhe manualmente adicionando switches, APs, rádios e computadores livres.</p>
                  </div>
                </button>

                {/* Opção 2: Usar pfSense XML */}
                <button 
                  onClick={() => {
                    setShowStartWizardModal(false);
                    fileInputRef.current?.click();
                  }}
                  className="group text-left p-5 rounded-2xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/25 hover:shadow-md transition-all flex items-start gap-4 cursor-pointer outline-none"
                >
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-100 transition-all shrink-0">
                    <Shield size={20} className="stroke-[2.5]" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-xs text-slate-900 group-hover:text-indigo-700 transition-all">Usar XML para ver do pfSense</h5>
                    <p className="text-[10px] text-slate-500 leading-normal">Gere automaticamente gateways, portas físicas ethernet, servidores DHCP, rotas e VPNs com o backup XML do pfSense.</p>
                  </div>
                </button>

                {/* Opção 3: Usar múltiplos XMLs ao selecionar pasta */}
                <button 
                  onClick={() => {
                    setShowStartWizardModal(false);
                    folderInputRef.current?.click();
                  }}
                  className="group text-left p-5 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/25 hover:shadow-md transition-all flex items-start gap-4 cursor-pointer outline-none"
                >
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-100 transition-all shrink-0">
                    <FolderOpen size={20} className="stroke-[2.5]" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-xs text-slate-900 group-hover:text-emerald-700 transition-all">Vários XMLs selecionando pasta</h5>
                    <p className="text-[10px] text-slate-500 leading-normal">Importe toda a sua carteira de clientes de uma vez! Lê pastas de backups e seleciona o mais recente de cada filial automaticamente.</p>
                  </div>
                </button>

                {/* Opção 4: Usar XML específico do Rune Map Topology */}
                <button 
                  onClick={() => {
                    setShowStartWizardModal(false);
                    runeFileInputRef.current?.click();
                  }}
                  className="group text-left p-5 rounded-2xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50/25 hover:shadow-md transition-all flex items-start gap-4 cursor-pointer outline-none"
                >
                  <div className="p-3 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-100 transition-all shrink-0">
                    <FileCode size={20} className="stroke-[2.5]" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-xs text-slate-900 group-hover:text-purple-700 transition-all">XML do Rune Map Topology</h5>
                    <p className="text-[10px] text-slate-500 leading-normal">Importe um mapa de rede completo com todas as conexões customizadas, modelos salvos e coordenadas de layout originais restauradas.</p>
                  </div>
                </button>

              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-500">
              <span className="flex items-center gap-1">Desenvolvido com excelência por <a href="https://www.runeprojects.com.br/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-extrabold">Rune Projects</a></span>
              <span className="font-bold text-slate-700 font-mono">by Guilherme Dill @ 2026</span>
            </div>

          </div>
        </div>
      )}

      {/* Dynamic Animated Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-900 border border-slate-800 text-white px-5 py-3.5 rounded-2xl shadow-2xl animate-slide-in pointer-events-auto max-w-sm" id="floating_toast_notification">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg shrink-0 ${
              toast.type === 'success' ? 'bg-emerald-500/25 text-emerald-400' :
              toast.type === 'warning' ? 'bg-amber-500/25 text-amber-400' :
              toast.type === 'error' ? 'bg-rose-500/25 text-rose-400' :
              'bg-blue-500/25 text-blue-400'
            }`}>
              <Info size={16} className="stroke-[2.5]" />
            </div>
            <p className="text-xs font-semibold tracking-wide text-white leading-tight">{toast.message}</p>
          </div>
        </div>
      )}

    </div>
  );
}
