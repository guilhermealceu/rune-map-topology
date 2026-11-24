import { PfSenseConfig } from './types';

export function parsePfSenseXML(xmlString: string): PfSenseConfig {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  const decodeHtmlEntities = (str: string) => {
    return str.replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&amp;/g, '&')
              .replace(/&quot;/g, '"')
              .replace(/&#039;/g, "'")
              .replace(/&#39;/g, "'");
  };

  const getTagValue = (parent: Element | null, tag: string) => {
    const val = parent?.querySelector(tag)?.textContent || '';
    return decodeHtmlEntities(val);
  };

  const getTagValues = (parent: Element | null, tag: string) => {
    const nodes = parent?.querySelectorAll(tag) || [];
    return Array.from(nodes).map(n => decodeHtmlEntities(n.textContent || ''));
  };

  const systemNode = xmlDoc.querySelector('pfsense > system');
  
  let version = '';
  const pkgRepoPath = getTagValue(systemNode, 'pkg_repo_conf_path');
  if (pkgRepoPath) {
    const match = pkgRepoPath.match(/repo-(.*)\.conf/);
    if (match) {
      version = match[1].replace(/_/g, '.');
    }
  }

  const config: PfSenseConfig = {
    version,
    system: {
      hostname: getTagValue(systemNode, 'hostname') || 'pfsense',
      domain: getTagValue(systemNode, 'domain') || 'home.arpa',
      dnsserver: getTagValues(systemNode, 'dnsserver'),
      timezone: getTagValue(systemNode, 'timezone') || 'UTC',
      timeservers: getTagValue(systemNode, 'timeservers') || 'pool.ntp.org',
      optimization: (getTagValue(systemNode, 'optimization') as any) || 'normal',
      hardware_profile: (getTagValue(systemNode, 'hardware_profile') as any) || 'physical',
      dnsallowoverride: systemNode?.querySelector('dnsallowoverride') !== null,
      dnsresolutionbehavior: (getTagValue(systemNode, 'dnsresolutionbehavior') as any) || 'local_fallback',
      language: getTagValue(systemNode, 'language') || 'en_US',
      prefer_ipv4: systemNode?.querySelector('prefer_ipv4') !== null,
      ipv6allow: systemNode?.querySelector('ipv6allow') !== null,
      dnslocalhost: (getTagValue(systemNode, 'dnslocalhost') as any) || 'remote',
      ssh: {
        enable: systemNode?.querySelector('ssh > enable') !== null,
        port: getTagValue(systemNode, 'ssh > port') || '22',
        sshguard_whitelist: getTagValue(systemNode, 'sshguard_whitelist') || '',
      },
    },
    users: [],
    interfaces: [],
    dhcpd: {},
    nat: { 
      rule: [],
      outbound: {
        mode: (getTagValue(xmlDoc.querySelector('pfsense > nat > outbound'), 'mode') as any) || 'automatic'
      }
    },
    gateways: { 
      gateway_item: [], 
      gateway_group: [],
      defaultgw4: getTagValue(xmlDoc.querySelector('pfsense > gateways'), 'defaultgw4')
    },
    aliases: { alias: [] },
    unbound: { hosts: [] },
    staticroutes: { route: [] },
    ipsec: { phase1: [], phase2: [] },
    dyndns: { item: [] },
    openvpn: { server: [] },
    vlans: [],
    zabbix: {
      agent: {
        enabled: xmlDoc.querySelector('pfsense > installedpackages > zabbixagentlts > config > agentenabled')?.textContent === 'on' || xmlDoc.querySelector('pfsense > zabbix > agent > enabled') !== null,
        server: getTagValue(xmlDoc.querySelector('pfsense > installedpackages > zabbixagentlts > config'), 'server') || getTagValue(xmlDoc.querySelector('pfsense > zabbix > agent'), 'server'),
        serveractive: getTagValue(xmlDoc.querySelector('pfsense > installedpackages > zabbixagentlts > config'), 'serveractive') || getTagValue(xmlDoc.querySelector('pfsense > zabbix > agent'), 'serveractive'),
        hostname: getTagValue(xmlDoc.querySelector('pfsense > installedpackages > zabbixagentlts > config'), 'hostname') || getTagValue(xmlDoc.querySelector('pfsense > zabbix > agent'), 'hostname'),
        listenport: getTagValue(xmlDoc.querySelector('pfsense > installedpackages > zabbixagentlts > config'), 'listenport') || getTagValue(xmlDoc.querySelector('pfsense > zabbix > agent'), 'listenport') || '10050',
        tlsconnect: getTagValue(xmlDoc.querySelector('pfsense > installedpackages > zabbixagentlts > config'), 'tlsconnect'),
        tlsaccept: getTagValue(xmlDoc.querySelector('pfsense > installedpackages > zabbixagentlts > config'), 'tlsaccept'),
      },
      proxy: {
        enabled: xmlDoc.querySelector('pfsense > installedpackages > zabbixproxylts > config > proxyenabled')?.textContent === 'on',
        server: getTagValue(xmlDoc.querySelector('pfsense > installedpackages > zabbixproxylts > config'), 'server'),
        serverport: getTagValue(xmlDoc.querySelector('pfsense > installedpackages > zabbixproxylts > config'), 'serverport') || '10051',
        hostname: getTagValue(xmlDoc.querySelector('pfsense > installedpackages > zabbixproxylts > config'), 'hostname'),
        proxymode: getTagValue(xmlDoc.querySelector('pfsense > installedpackages > zabbixproxylts > config'), 'proxymode') || '0',
      }
    }
  };

  // Parse Users
  const userNodes = xmlDoc.querySelectorAll('pfsense > system > user');
  userNodes.forEach(u => {
    config.users.push({
      name: getTagValue(u, 'name'),
      descr: getTagValue(u, 'descr'),
      priv: getTagValues(u, 'priv'),
      password: getTagValue(u, 'password'),
    });
  });

  // Parse Interfaces
  const interfacesNode = xmlDoc.querySelector('pfsense > interfaces');
  if (interfacesNode) {
    Array.from(interfacesNode.children).forEach(node => {
      config.interfaces.push({
        id: node.tagName,
        descr: getTagValue(node, 'descr'),
        if: getTagValue(node, 'if'),
        enable: node.querySelector('enable') !== null,
        ipaddr: getTagValue(node, 'ipaddr') as any,
        subnet: getTagValue(node, 'subnet'),
        gateway: getTagValue(node, 'gateway'),
        ipaddrv6: getTagValue(node, 'ipaddrv6') as any,
        subnetv6: getTagValue(node, 'subnetv6'),
      });
    });
  }

  // Parse DHCPD
  const dhcpdNode = xmlDoc.querySelector('pfsense > dhcpd');
  if (dhcpdNode) {
    Array.from(dhcpdNode.children).forEach(node => {
      const range = node.querySelector('range');
      config.dhcpd[node.tagName] = {
        enable: node.querySelector('enable') !== null,
        range: {
          from: getTagValue(range, 'from'),
          to: getTagValue(range, 'to'),
        },
        dnsserver: getTagValues(node, 'dnsserver'),
        gateway: getTagValue(node, 'gateway'),
        pools: Array.from(node.querySelectorAll('pool')).map(p => ({
          from: getTagValue(p, 'from'),
          to: getTagValue(p, 'to')
        })),
        staticmap: Array.from(node.querySelectorAll('staticmap')).map(sm => ({
          mac: getTagValue(sm, 'mac'),
          ipaddr: getTagValue(sm, 'ipaddr'),
          hostname: getTagValue(sm, 'hostname'),
          descr: getTagValue(sm, 'descr'),
        }))
      };
    });
  }

  // Parse Filter Rules
  const filterNodes = xmlDoc.querySelectorAll('pfsense > filter > rule');
  if (filterNodes.length > 0) {
    config.filter = { rule: [] };
    filterNodes.forEach(f => {
      config.filter!.rule.push({
        type: getTagValue(f, 'type') || 'pass',
        interface: getTagValue(f, 'interface') || 'lan',
        ipprotocol: getTagValue(f, 'ipprotocol') || 'inet',
        protocol: getTagValue(f, 'protocol') || 'any',
        source: {
          any: f.querySelector('source > any') !== null,
          network: getTagValue(f.querySelector('source'), 'network'),
          address: getTagValue(f.querySelector('source'), 'address')
        },
        destination: {
          any: f.querySelector('destination > any') !== null,
          network: getTagValue(f.querySelector('destination'), 'network'),
          address: getTagValue(f.querySelector('destination'), 'address'),
          port: getTagValue(f.querySelector('destination'), 'port'),
        },
        descr: getTagValue(f, 'descr')
      });
    });
  }

  // Parse NAT Rules
  const natNodes = xmlDoc.querySelectorAll('pfsense > nat > rule');
  natNodes.forEach(n => {
    config.nat.rule.push({
      interface: getTagValue(n, 'interface') || 'wan',
      protocol: getTagValue(n, 'protocol') || 'tcp',
      target: getTagValue(n, 'target'),
      localport: getTagValue(n, 'local-port'),
      destination: {
        port: getTagValue(n, 'destination > port'),
      },
      descr: getTagValue(n, 'descr'),
    });
  });

  // Parse Gateways
  const gwItems = xmlDoc.querySelectorAll('pfsense > gateways > gateway_item');
  gwItems.forEach(i => {
    config.gateways.gateway_item.push({
      name: getTagValue(i, 'name'),
      interface: getTagValue(i, 'interface'),
      gateway: getTagValue(i, 'gateway'),
      monitor: getTagValue(i, 'monitor'),
      descr: getTagValue(i, 'descr'),
      weight: parseInt(getTagValue(i, 'weight') || '1', 10),
    });
  });

  const gwGroups = xmlDoc.querySelectorAll('pfsense > gateways > gateway_group');
  gwGroups.forEach(g => {
    const rawItems = getTagValues(g, 'item');
    const structuredItems = rawItems.map(raw => {
      const parts = raw.split('|');
      return {
        gateway: parts[0] || '',
        tier: parseInt(parts[1] || '1', 10)
      };
    });

    config.gateways.gateway_group.push({
      name: getTagValue(g, 'name'),
      items: structuredItems,
      trigger: getTagValue(g, 'trigger'),
      descr: getTagValue(g, 'descr'),
    });
  });

  // Parse Aliases
  const aliasNodes = xmlDoc.querySelectorAll('pfsense > aliases > alias');
  aliasNodes.forEach(a => {
    config.aliases.alias.push({
      name: getTagValue(a, 'name'),
      type: getTagValue(a, 'type') as any,
      address: getTagValue(a, 'address'),
      descr: getTagValue(a, 'descr'),
    });
  });

  // Parse Unbound Hosts
  const hostNodes = xmlDoc.querySelectorAll('pfsense > unbound > hosts');
  hostNodes.forEach(h => {
    config.unbound.hosts.push({
      host: getTagValue(h, 'host'),
      domain: getTagValue(h, 'domain'),
      ip: getTagValue(h, 'ip'),
      descr: getTagValue(h, 'descr'),
    });
  });

  // Parse Static Routes
  const routeNodes = xmlDoc.querySelectorAll('pfsense > staticroutes > route');
  routeNodes.forEach(r => {
    config.staticroutes.route.push({
      network: getTagValue(r, 'network'),
      gateway: getTagValue(r, 'gateway'),
      descr: getTagValue(r, 'descr'),
    });
  });

  // Parse IPsec
  const p1Nodes = xmlDoc.querySelectorAll('pfsense > ipsec > phase1');
  p1Nodes.forEach(p => {
    config.ipsec.phase1.push({
      ikeid: getTagValue(p, 'ikeid'),
      remote_gateway: getTagValue(p, 'remote-gateway'),
      interface: getTagValue(p, 'interface'),
      descr: getTagValue(p, 'descr'),
      authentication_method: getTagValue(p, 'authentication_method'),
      pre_shared_key: getTagValue(p, 'pre-shared-key'),
      encryption_algorithm: {
        name: getTagValue(p, 'encryption-algorithm > name'),
        keylen: getTagValue(p, 'encryption-algorithm > keylen'),
      },
      hash_algorithm: getTagValue(p, 'hash-algorithm'),
      dhgroup: getTagValue(p, 'dhgroup'),
    });
  });

  const p2Nodes = xmlDoc.querySelectorAll('pfsense > ipsec > phase2');
  p2Nodes.forEach(p => {
    config.ipsec.phase2.push({
      ikeid: getTagValue(p, 'ikeid'),
      mode: getTagValue(p, 'mode'),
      localid: {
        type: getTagValue(p, 'localid > type'),
        address: getTagValue(p, 'localid > address'),
        netbits: getTagValue(p, 'localid > netbits'),
      },
      remoteid: {
        type: getTagValue(p, 'remoteid > type'),
        address: getTagValue(p, 'remoteid > address'),
        netbits: getTagValue(p, 'remoteid > netbits'),
      },
      protocol: getTagValue(p, 'protocol'),
      encryption_algorithm_option: Array.from(p.querySelectorAll('encryption-algorithm-option')).map(opt => ({
        name: getTagValue(opt as any, 'name'),
        keylen: getTagValue(opt as any, 'keylen'),
      })),
      hash_algorithm_option: getTagValues(p, 'hash-algorithm-option'),
      pfsgroup: getTagValue(p, 'pfsgroup'),
      descr: getTagValue(p, 'descr'),
    });
  });

  // Parse DynDNS
  const dyndnsNodes = xmlDoc.querySelectorAll('pfsense > dyndnses > dyndns');
  const legacyDyndnsNodes = xmlDoc.querySelectorAll('pfsense > dyndns > type');
  
  const processDyndnsNode = (d: Element) => {
    config.dyndns!.item.push({
      id: getTagValue(d, 'id'),
      enable: d.querySelector('enable') !== null || d.getAttribute('enable') === 'enabled',
      interface: getTagValue(d, 'interface'),
      type: getTagValue(d, 'type') || getTagValue(d, 'service'),
      host: getTagValue(d, 'host'),
      username: getTagValue(d, 'username'),
      password: getTagValue(d, 'password'),
      domainname: getTagValue(d, 'domainname'),
      descr: getTagValue(d, 'descr'),
    });
  };

  dyndnsNodes.forEach(processDyndnsNode);
  legacyDyndnsNodes.forEach(processDyndnsNode);

  // Parse VLANs
  const vlanNodes = xmlDoc.querySelectorAll('pfsense > vlans > vlan');
  vlanNodes.forEach(v => {
    if (!config.vlans) config.vlans = [];
    config.vlans.push({
      if: getTagValue(v, 'if'),
      tag: getTagValue(v, 'tag'),
      descr: getTagValue(v, 'descr'),
      vlanif: getTagValue(v, 'vlanif') || `vlan0.${getTagValue(v, 'tag')}`,
    });
  });

  return config;
}

export interface GenerateOptions {
  version?: string;
  sections?: ('system' | 'interfaces' | 'dhcpd' | 'gateways' | 'aliases' | 'unbound' | 'nat' | 'staticroutes' | 'vlans' | 'ipsec' | 'dyndnses' | 'installedpackages')[];
}

export function mergeConfigs(target: PfSenseConfig, source: PfSenseConfig): PfSenseConfig {
  // --- Truly Smart Merge Logic ---
  // 1. Start with a clone of the SOURCE (all your rules, subnets, users, and complexity).
  const merged: PfSenseConfig = JSON.parse(JSON.stringify(source));

  // 2. surgically replace Physical Interface Names ('if') from the TARGET hardware.
  // This ensures the config "fits" the new appliance physical ports (ex: igc0, igc1).
  source.interfaces.forEach((sourceIface, idx) => {
    // Try to find a logical match by ID (wan, lan, opt1)
    const targetHardwareMatch = target.interfaces.find(t => t.id === sourceIface.id);
    
    if (targetHardwareMatch) {
      // Hardware mapping: LAN in old config -> igc1 on new appliance (if igc1 is LAN on target)
      merged.interfaces[idx].if = targetHardwareMatch.if;
    } else {
      // If we can't find an exact ID match, we fallback to sequence (Target[0] is WAN, etc)
      // but only if it's a common interface like wan/lan.
      const targetByPos = target.interfaces[idx];
      if (targetByPos && (sourceIface.id === 'wan' || sourceIface.id === 'lan')) {
         merged.interfaces[idx].if = targetByPos.if;
      }
    }
  });

  // 3. Add any EXTRA interfaces from the Target (new hardware usually has more ports)
  // We add them as disabled placeholders so the user sees them in our generator.
  target.interfaces.forEach(targetIface => {
    const alreadyMerged = merged.interfaces.find(i => i.id === targetIface.id);
    if (!alreadyMerged) {
      merged.interfaces.push({
        ...targetIface,
        enable: false,
        descr: `NEW PORT ${targetIface.if.toUpperCase()}`,
        // Set to a safe default
        ipaddr: 'dhcp'
      });
    }
  });

  // 4. Identity Check: Usually you want to keep the NEW appliance's hostname if it was pre-set,
  // but if the user is migrating, they probably want the OLD identity. 
  // We'll keep the Source's system identity as default (already done via clone).

  return merged;
}

export function generatePfSenseXML(config: PfSenseConfig, options?: GenerateOptions): string {
  // --- IPv6 Sanitization ---
  // If IPv6 is disabled, we strip related configurations to prevent boot errors in pfSense
  let sanitized = JSON.parse(JSON.stringify(config)) as PfSenseConfig;
  
  if (!sanitized.system.ipv6allow) {
    // 1. Clean up Interfaces
    sanitized.interfaces.forEach(iface => {
      if (iface.ipaddrv6 === 'dhcp6' || iface.ipaddrv6 === '6rd' || iface.ipaddrv6 === '6to4') {
        iface.ipaddrv6 = undefined;
        iface.subnetv6 = undefined;
      } else if (iface.ipaddrv6 && iface.ipaddrv6.includes(':')) {
        // Simple static IPv6 detection
        iface.ipaddrv6 = undefined;
        iface.subnetv6 = undefined;
      }
    });

    // 2. Clean up Gateways (remove those with IPv6 addresses)
    sanitized.gateways.gateway_item = sanitized.gateways.gateway_item.filter(gw => !gw.gateway.includes(':'));
    
    // 3. Clean up Gateway Groups (remove references to IPv6 gateways)
    sanitized.gateways.gateway_group.forEach(group => {
      const v4Gateways = sanitized.gateways.gateway_item.map(g => g.name);
      group.items = group.items.filter(item => v4Gateways.includes(item.gateway));
    });
    sanitized.gateways.gateway_group = sanitized.gateways.gateway_group.filter(group => group.items.length > 0);

    // 4. Clean up Firewall Rules (remove rules with ipprotocol='inet6')
    if (sanitized.filter?.rule) {
      sanitized.filter.rule = sanitized.filter.rule.filter(rule => rule.ipprotocol !== 'inet6');
    }

    // 5. Clean up Static Routes
    sanitized.staticroutes.route = sanitized.staticroutes.route.filter(route => !route.network.includes(':') && !route.gateway.includes(':'));
  }

  const { system, interfaces, dhcpd, users, nat, staticroutes, gateways, aliases, unbound, ipsec, dyndns, vlans } = sanitized;

  const xmlVersion = options?.version || '24.0';
  const sections = options?.sections || [];
  const exportAll = sections.length === 0;

  const interfacesXml = interfaces.map(iface => `
		<${iface.id}>
			${iface.enable ? '<enable></enable>' : ''}
			<if>${iface.if}</if>
			<descr><![CDATA[${iface.descr}]]></descr>
			<ipaddr>${iface.ipaddr}</ipaddr>
			${iface.subnet ? `<subnet>${iface.subnet}</subnet>` : ''}
			${iface.gateway ? `<gateway>${iface.gateway}</gateway>` : ''}
			${iface.ipaddrv6 ? `<ipaddrv6>${iface.ipaddrv6}</ipaddrv6>` : ''}
			${iface.subnetv6 ? `<subnetv6>${iface.subnetv6}</subnetv6>` : ''}
		</${iface.id}>`).join('');

  const dhcpdXml = Object.entries(dhcpd).map(([id, settings]) => `
		<${id}>
			${settings.enable ? '<enable></enable>' : ''}
			<range>
				<from>${settings.range.from}</from>
				<to>${settings.range.to}</to>
			</range>
			${settings.dnsserver?.map(dns => `<dnsserver>${dns}</dnsserver>`).join('\n\t\t\t') || ''}
			${settings.gateway ? `<gateway>${settings.gateway}</gateway>` : ''}
			${settings.pools?.map(p => `
			<pool>
				<from>${p.from}</from>
				<to>${p.to}</to>
			</pool>`).join('') || ''}
			${settings.staticmap?.map(sm => `
			<staticmap>
				<mac>${sm.mac}</mac>
				<ipaddr>${sm.ipaddr}</ipaddr>
				<hostname>${sm.hostname}</hostname>
				<descr><![CDATA[${sm.descr}]]></descr>
			</staticmap>`).join('') || ''}
		</${id}>`).join('');

  const usersXml = users.map(user => `
		<user>
			<name>${user.name}</name>
			<descr><![CDATA[${user.descr}]]></descr>
			<scope>user</scope>
			${user.password ? `<password>${user.password}</password>` : ''}
			${user.priv.map(p => `<priv>${p}</priv>`).join('\n\t\t\t')}
		</user>`).join('');

  const natXml = nat.rule.map(rule => `
		<rule>
			<interface>${rule.interface}</interface>
			<protocol>${rule.protocol}</protocol>
			<target>${rule.target}</target>
			<local-port>${rule.localport}</local-port>
			<destination>
				<port>${rule.destination.port}</port>
			</destination>
			<descr><![CDATA[${rule.descr}]]></descr>
		</rule>`).join('');

  const routesXml = staticroutes.route.map(route => `
		<route>
			<network>${route.network}</network>
			<gateway>${route.gateway}</gateway>
			<descr><![CDATA[${route.descr}]]></descr>
		</route>`).join('');

  const gwItemsXml = gateways.gateway_item.map(i => `
		<gateway_item>
			<name>${i.name}</name>
			<interface>${i.interface}</interface>
			<gateway>${i.gateway}</gateway>
			<weight>${i.weight || 1}</weight>
			${i.monitor ? `<monitor>${i.monitor}</monitor>` : ''}
			<descr><![CDATA[${i.descr}]]></descr>
		</gateway_item>`).join('');

  const gwGroupsXml = gateways.gateway_group.map(g => `
		<gateway_group>
			<name>${g.name}</name>
			${g.items.map(it => `<item>${it.gateway}|${it.tier}|address</item>`).join('\n\t\t\t')}
			<trigger>${g.trigger}</trigger>
			<descr><![CDATA[${g.descr}]]></descr>
		</gateway_group>`).join('');

  const aliasesXml = aliases.alias.map(a => `
		<alias>
			<name>${a.name}</name>
			<type>${a.type}</type>
			<address>${a.address}</address>
			<descr><![CDATA[${a.descr}]]></descr>
		</alias>`).join('');

  const unboundXml = unbound.hosts.map(h => `
		<hosts>
			<host>${h.host}</host>
			<domain>${h.domain}</domain>
			<ip>${h.ip}</ip>
			<descr><![CDATA[${h.descr}]]></descr>
		</hosts>`).join('');

  const ipsecP1Xml = ipsec.phase1.map(p => `
		<phase1>
			<ikeid>${p.ikeid}</ikeid>
			<remote-gateway>${p.remote_gateway}</remote-gateway>
			<interface>${p.interface}</interface>
			<descr><![CDATA[${p.descr}]]></descr>
			<authentication_method>${p.authentication_method}</authentication_method>
			<pre-shared-key>${p.pre_shared_key}</pre-shared-key>
			<encryption-algorithm>
				<name>${p.encryption_algorithm.name}</name>
				${p.encryption_algorithm.keylen ? `<keylen>${p.encryption_algorithm.keylen}</keylen>` : ''}
			</encryption-algorithm>
			<hash-algorithm>${p.hash_algorithm}</hash-algorithm>
			<dhgroup>${p.dhgroup}</dhgroup>
			<protocol>inet</protocol>
			<myid_type>myaddress</myid_type>
		</phase1>`).join('');

  const ipsecP2Xml = ipsec.phase2.map(p => `
		<phase2>
			<ikeid>${p.ikeid}</ikeid>
			<mode>${p.mode}</mode>
			<localid>
				<type>${p.localid.type}</type>
				${p.localid.address ? `<address>${p.localid.address}</address>` : ''}
				${p.localid.netbits ? `<netbits>${p.localid.netbits}</netbits>` : ''}
			</localid>
			<remoteid>
				<type>${p.remoteid.type}</type>
				${p.remoteid.address ? `<address>${p.remoteid.address}</address>` : ''}
				${p.remoteid.netbits ? `<netbits>${p.remoteid.netbits}</netbits>` : ''}
			</remoteid>
			<protocol>${p.protocol}</protocol>
			${p.encryption_algorithm_option.map(opt => `
			<encryption-algorithm-option>
				<name>${opt.name}</name>
				${opt.keylen ? `<keylen>${opt.keylen}</keylen>` : ''}
			</encryption-algorithm-option>`).join('')}
			${p.hash_algorithm_option.map(h => `<hash-algorithm-option>${h}</hash-algorithm-option>`).join('')}
			<pfsgroup>${p.pfsgroup}</pfsgroup>
			<descr><![CDATA[${p.descr}]]></descr>
		</phase2>`).join('');

  const dyndnsXml = dyndns?.item.map(d => `
		<dyndns>
			<type>${d.type}</type>
			<interface>${d.interface}</interface>
			<host>${d.host}</host>
			<username>${d.username}</username>
			${d.password ? `<password>${d.password}</password>` : ''}
			${d.domainname ? `<domainname>${d.domainname}</domainname>` : ''}
			${d.enable ? '<enable></enable>' : ''}
			<descr><![CDATA[${d.descr}]]></descr>
		</dyndns>`).join('') || '';

  const vlansXml = (vlans || []).map(v => `
		<vlan>
			<if>${v.if}</if>
			<tag>${v.tag}</tag>
			<pcp>0</pcp>
			<descr><![CDATA[${v.descr}]]></descr>
			<vlanif>${v.vlanif || `vlan0.${v.tag}`}</vlanif>
		</vlan>`).join('');

  const vlansBlock = vlans && vlans.length > 0 ? `
	<vlans>
		${vlansXml}
	</vlans>` : '';

  const zabbixXml = `
		<zabbixagentlts>
			<config>
				<agentenabled>${config.zabbix?.agent?.enabled ? 'on' : 'off'}</agentenabled>
				<server>${config.zabbix?.agent?.server}</server>
				<serveractive>${config.zabbix?.agent?.serveractive}</serveractive>
				<hostname>${config.zabbix?.agent?.hostname}</hostname>
				<listenport>${config.zabbix?.agent?.listenport}</listenport>
				<tlsconnect>${config.zabbix?.agent?.tlsconnect || 'unencrypted'}</tlsconnect>
				<tlsaccept>${config.zabbix?.agent?.tlsaccept || 'unencrypted'}</tlsaccept>
			</config>
		</zabbixagentlts>
		<zabbixproxylts>
			<config>
				<proxyenabled>${config.zabbix?.proxy?.enabled ? 'on' : 'off'}</proxyenabled>
				<server>${config.zabbix?.proxy?.server}</server>
				<serverport>${config.zabbix?.proxy?.serverport}</serverport>
				<hostname>${config.zabbix?.proxy?.hostname}</hostname>
				<proxymode>${config.zabbix?.proxy?.proxymode || '0'}</proxymode>
			</config>
		</zabbixproxylts>`;

  // Base XML structure helper to output blocks conditionally
  const renderBlock = (blockName: string, content: string) => {
    if (exportAll || sections.includes(blockName as any)) {
      if (blockName === 'vlans' && !content) return ''; // Special case if no content
      if (blockName === 'vlans' && content) return content; // vlans is already formatted as <vlans>...</vlans>
      return `\n	<${blockName}>\n		${content.trim()}\n	</${blockName}>`;
    }
    return '';
  };

  let cryptoHardware = '<crypto_hardware>aesni</crypto_hardware>';
  let hwOffload = '';
  if (system.hardware_profile === 'proxmox' || system.hardware_profile === 'hyperv') {
    // Ambientes que exigem desligar tudo, incluindo Checksum Offload (ex: VirtIO)
    hwOffload = `
		<disablechecksumoffloading>1</disablechecksumoffloading>
		<disablesegmentationoffloading>1</disablesegmentationoffloading>
		<disablelargereceiveoffloading>1</disablelargereceiveoffloading>`;
  } else {
    // Padrão de fábrica do pfSense (Bare Metal e VMware ESXi):
    // Checksum offload fica habilitado, mas TSO e LRO vêm desabilitados de fábrica no pfSense.
    hwOffload = `
		<disablesegmentationoffloading>1</disablesegmentationoffloading>
		<disablelargereceiveoffloading>1</disablelargereceiveoffloading>`;
  }

  const systemBlockContent = `
		<optimization>${system.optimization}</optimization>
		<hardware_profile>${system.hardware_profile || 'physical'}</hardware_profile>
		${cryptoHardware}
		${hwOffload}
		<hostname>${system.hostname}</hostname>
		<domain>${system.domain}</domain>
		<language>${system.language || 'en_US'}</language>
		<dnslocalhost>${system.dnslocalhost || 'remote'}</dnslocalhost>
		${system.prefer_ipv4 ? '<prefer_ipv4></prefer_ipv4>' : ''}
		${system.ipv6allow ? '<ipv6allow></ipv6allow>' : ''}
		${system.dnsserver.map((dns, idx) => {
			const gwMatch = gateways.gateway_item.find(gw => gw.monitor === dns);
			const dnsGwBlock = gwMatch ? `\n		<dnsgw_${idx}>${gwMatch.name}</dnsgw_${idx}>` : '';
			return `<dnsserver>${dns}</dnsserver>${dnsGwBlock}`;
		}).join('\n\t\t')}
		<dnsresolutionbehavior>${system.dnsresolutionbehavior || 'local_fallback'}</dnsresolutionbehavior>
		${system.dnsallowoverride ? '<dnsallowoverride></dnsallowoverride>' : ''}
		<timezone>${system.timezone}</timezone>
		<timeservers>${system.timeservers}</timeservers>
		<webgui>
			<protocol>https</protocol>
			<roaming>enabled</roaming>
		</webgui>
		<ssh>
			${system.ssh.enable ? '<enable>enabled</enable>' : ''}
			<port>${system.ssh.port}</port>
		</ssh>
		<sshguard_whitelist>${system.ssh.sshguard_whitelist}</sshguard_whitelist>
		${usersXml}
  `;

  const gatewaysBlockContent = `
		${gwItemsXml}
		${gwGroupsXml}
		${gateways.defaultgw4 ? `<defaultgw4>${gateways.defaultgw4}</defaultgw4>` : ''}
  `;

  const natBlockContent = `
		<outbound>
			<mode>${config.nat.outbound?.mode || 'automatic'}</mode>
		</outbound>
		${natXml}
  `;

  const ipsecBlockContent = `
		${ipsecP1Xml}
		${ipsecP2Xml}
  `;

  const filterXml = (config.filter?.rule || []).map(r => `
		<rule>
			<type>${r.type}</type>
			<interface>${r.interface}</interface>
			<ipprotocol>${r.ipprotocol}</ipprotocol>
			<statetype><![CDATA[keep state]]></statetype>
			<descr><![CDATA[${r.descr}]]></descr>
			<source>
				${r.source.any ? '<any></any>' : r.source.network ? `<network>${r.source.network}</network>` : r.source.address ? `<address>${r.source.address}</address>` : ''}
			</source>
			<destination>
				${r.destination.any ? '<any></any>' : r.destination.network ? `<network>${r.destination.network}</network>` : r.destination.address ? `<address>${r.destination.address}</address>` : ''}
				${r.destination.port ? `<port>${r.destination.port}</port>` : ''}
			</destination>
			${r.protocol && r.protocol !== 'any' ? `<protocol>${r.protocol}</protocol>` : ''}
		</rule>`).join('');

  let xmlParts = [
    `<?xml version="1.0"?>`,
    `<pfsense>`,
    `	<version>${xmlVersion}</version>`,
    renderBlock('system', systemBlockContent),
    renderBlock('interfaces', interfacesXml),
    renderBlock('dhcpd', dhcpdXml),
    renderBlock('filter', filterXml),
    renderBlock('gateways', gatewaysBlockContent),
    renderBlock('aliases', aliasesXml),
    renderBlock('unbound', `<enable></enable>\n		${unboundXml}`),
    renderBlock('nat', natBlockContent),
    renderBlock('staticroutes', routesXml),
    renderBlock('vlans', vlansBlock),
    renderBlock('ipsec', ipsecBlockContent),
    renderBlock('dyndnses', dyndnsXml),
    renderBlock('installedpackages', zabbixXml),
    `</pfsense>`
  ];

  return xmlParts.filter(Boolean).join('');
}

export function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export function exportSiteToRuneXML(
  siteName: string,
  isManual: boolean,
  lastBackupDate: string,
  xmlContent: string | undefined,
  customNodes: any[],
  customEdges: any[],
  nodePositions: { [nodeId: string]: { x: number; y: number } }
): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<runemap_topology>\n`;
  xml += `  <metadata>\n`;
  xml += `    <siteName>${escapeXml(siteName)}</siteName>\n`;
  xml += `    <isManual>${isManual}</isManual>\n`;
  xml += `    <lastBackupDate>${escapeXml(lastBackupDate)}</lastBackupDate>\n`;
  if (xmlContent) {
    xml += `    <xmlContent>${escapeXml(xmlContent)}</xmlContent>\n`;
  }
  xml += `  </metadata>\n`;
  
  xml += `  <nodes>\n`;
  customNodes.forEach(node => {
    const pos = nodePositions[node.id] || node.position || { x: 100, y: 100 };
    xml += `    <node id="${escapeXml(node.id)}" type="${escapeXml(node.data?.type || '')}" label="${escapeXml(node.data?.label || '')}" ip="${escapeXml(node.data?.ip || '')}" mac="${escapeXml(node.data?.mac || '')}" model="${escapeXml(node.data?.model || '')}" vlan="${escapeXml(node.data?.vlan || '')}" descr="${escapeXml(node.data?.descr || '')}" isCustom="${node.data?.isCustom ? 'true' : 'false'}" x="${pos.x}" y="${pos.y}" />\n`;
  });
  xml += `  </nodes>\n`;
  
  xml += `  <edges>\n`;
  customEdges.forEach(edge => {
    xml += `    <edge id="${escapeXml(edge.id)}" source="${escapeXml(edge.source)}" target="${escapeXml(edge.target)}" label="${escapeXml(edge.data?.label || '')}" media="${escapeXml(edge.data?.media || 'ethernet')}" color="${escapeXml(edge.data?.color || '#475569')}" />\n`;
  });
  xml += `  </edges>\n`;
  xml += `</runemap_topology>`;
  return xml;
}

export function parseRuneXML(xmlStr: string) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlStr, "text/xml");
  
  const root = xmlDoc.getElementsByTagName("runemap_topology")[0];
  if (!root) {
    throw new Error("Não é um arquivo de topologia Rune Map válido.");
  }
  
  const siteName = xmlDoc.getElementsByTagName("siteName")[0]?.textContent || "Topologia Rune";
  const isManual = xmlDoc.getElementsByTagName("isManual")[0]?.textContent === "true";
  const lastBackupDate = xmlDoc.getElementsByTagName("lastBackupDate")[0]?.textContent || new Date().toLocaleString();
  const xmlContent = xmlDoc.getElementsByTagName("xmlContent")[0]?.textContent || undefined;
  
  // Parse nodes
  const nodeElements = xmlDoc.getElementsByTagName("node");
  const customNodes: any[] = [];
  const nodePositions: { [nodeId: string]: { x: number; y: number } } = {};
  
  for (let i = 0; i < nodeElements.length; i++) {
    const el = nodeElements[i];
    const id = el.getAttribute("id") || `n-${Date.now()}-${i}`;
    const type = el.getAttribute("type") || 'switch';
    const label = el.getAttribute("label") || '';
    const ip = el.getAttribute("ip") || undefined;
    const mac = el.getAttribute("mac") || undefined;
    const model = el.getAttribute("model") || undefined;
    const vlan = el.getAttribute("vlan") || undefined;
    const descr = el.getAttribute("descr") || undefined;
    const isCustom = el.getAttribute("isCustom") === "true";
    const x = parseFloat(el.getAttribute("x") || "100");
    const y = parseFloat(el.getAttribute("y") || "100");
    
    customNodes.push({
      id,
      type: 'customNetwork',
      position: { x, y },
      data: {
        label,
        type,
        ip,
        mac,
        model,
        vlan,
        descr,
        isCustom
      }
    });
    
    nodePositions[id] = { x, y };
  }
  
  // Parse edges
  const edgeElements = xmlDoc.getElementsByTagName("edge");
  const customEdges: any[] = [];
  
  for (let i = 0; i < edgeElements.length; i++) {
    const el = edgeElements[i];
    const id = el.getAttribute("id") || `e-${Date.now()}-${i}`;
    const source = el.getAttribute("source") || '';
    const target = el.getAttribute("target") || '';
    const label = el.getAttribute("label") || '';
    const media = el.getAttribute("media") || 'ethernet';
    const color = el.getAttribute("color") || '#475569';
    
    let style: any = { stroke: color, strokeWidth: 2.5 };
    let animated = true;
    
    if (media === 'fiber') {
      style = { stroke: color, strokeWidth: 3.5 };
      animated = false;
    } else if (media === 'wireless') {
      style = { stroke: color, strokeWidth: 2.5, strokeDasharray: '6 6' };
    } else if (media === 'vpn') {
      style = { stroke: color, strokeWidth: 2.5, strokeDasharray: '10 4 animate' };
    } else if (media === 'virtual') {
      style = { stroke: color, strokeWidth: 1.5, strokeDasharray: '2 2' };
      animated = false;
    }
    
    customEdges.push({
      id,
      source,
      target,
      animated,
      style,
      markerEnd: {
        type: 'arrowclosed',
        color: color,
      },
      data: {
        label,
        media,
        color
      }
    });
  }
  
  return {
    siteName,
    isManual,
    lastBackupDate,
    xmlContent,
    customNodes,
    customEdges,
    nodePositions
  };
}
