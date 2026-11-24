# Rune Map Topology

Gera **diagramas de topologia de rede** a partir dos backups do pfSense®, com edição manual dos equipamentos e um relatório de auditoria da rede.

> 📸 _Print de um diagrama_

## Sobre

Documentação de rede quase sempre está desatualizada: ninguém tem tempo de redesenhar o diagrama de cada filial a cada mudança. O Rune Map Topology parte do que já existe, o backup XML do pfSense, e monta o diagrama sozinho, com interfaces, VLANs, DHCP, gateways e túneis. Depois você completa à mão com switches, antenas, access points e câmeras, e salva tudo para continuar depois.

## Funcionalidades

- **Diagrama automático do XML do pfSense**: interfaces, VLANs, servidores DHCP, gateways e túneis IPsec
- **Importação de pastas inteiras**: separa os backups por filial e usa o mais recente de cada uma
- **Edição manual**: adicione switches, antenas PTP, access points, servidores, impressoras e câmeras IP, com tipos personalizados
- **Arquivo de projeto (.xml Rune)**: salva o diagrama com as posições e as conexões manuais, para reabrir exatamente igual
- **Relatório de auditoria local**: conflitos de IP, riscos de segurança e boas práticas
- **Modo foco**: esconde os painéis laterais para ver só a topologia

## Privacidade

A leitura do XML e a auditoria acontecem no seu navegador. Chaves IPsec, hashes de senha e IPs não vão para nenhum servidor.

> O servidor já tem uma rota de auditoria com IA (`/api/audit-config`, com Gemini ou Ollama), mas ela ainda não está ligada à interface. Quando estiver, vai enviar o XML completo ao provedor escolhido.

## Requisitos

- Node.js 20+

## Como rodar

```bash
npm install
npm run dev
```

Abra http://localhost:3000. Para produção: `npm run build && npm start`.

## Autor

Criado por **Guilherme Dill** · [RUNE Projects](https://www.runeprojects.com.br) · [GitHub](https://github.com/guilhermealceu)

## Licença

[MIT](LICENSE)

<sub>pfSense® é marca registrada da Rubicon Communications, LLC (Netgate). Este projeto é independente e não tem vínculo com a Netgate.</sub>
