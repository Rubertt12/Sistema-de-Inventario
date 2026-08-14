# RRN Agent Windows

Agente leve para inventário automatizado de endpoints do RRN Manager.

## O que coleta

- Hostname
- Tipo estimado do equipamento
- Fabricante e modelo
- Serial/Service Tag e patrimônio SMBIOS quando disponíveis
- CPU e memória RAM
- Discos locais e espaço livre
- Windows, versão e build
- IPs e endereços MAC
- Usuário logado e domínio
- Fuso horário
- Última comunicação

A localização é calculada pelo backend de forma aproximada a partir do IP público quando não houver uma localização mais precisa fornecida pelo dispositivo.

## Segurança

O código de instalação é temporário. Depois do primeiro vínculo o backend devolve uma credencial exclusiva do dispositivo. O agente salva essa credencial protegida pelo DPAPI do Windows no escopo da máquina.

## Instalação

No RRN Manager abra **Máquinas em estoque > Agente RRN**, gere um código e copie o comando de instalação. O PowerShell baixa a release `rrn-agent-latest`, vincula a máquina e cria duas tarefas no Agendador do Windows:

- 08:00 — heartbeat da manhã
- 18:00 — heartbeat da tarde

O inventário inicial é enviado imediatamente durante o vínculo.

## Comandos do executável

```powershell
RRN.Agent.exe enroll --code RRN-XXXXXXXX
RRN.Agent.exe run --kind manual
RRN.Agent.exe status
```

## Remoção

Execute `agent/uninstall.ps1` como administrador ou use o arquivo disponibilizado na release do agente.
