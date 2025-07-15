function importFromCSVButton() {
    document.getElementById('csvInput').click();
}

function exportToCSV() {
    let csvContent = "Setor;Tipo;Nome da Máquina;Etiqueta;Em Manutenção;Tempo de Manutenção;Usuário;Observações;ID\n";


    setores.forEach(setor => {
        setor.maquinas.forEach(maquina => {
            const observacoes = maquina.chamado?.map(chamado => 
                `"${chamado.observacao} - Prioridade: ${chamado.prioridade}"`
            ).join(" | ") || "Nenhuma Observação";

            const row = `"${setor.nome}";"${maquina.tipo}";"${maquina.numeroSerie || maquina.nome || 'Sem nome'}";"${maquina.etiqueta || 'Sem etiqueta'}";${maquina.emManutencao};${maquina.tempoManutencao};"${maquina.usuarioResponsavel || ''}";${observacoes};"${maquina.id || ''}"\n`;

            csvContent += row;
        });
    });

    const csvContentComBOM = '\uFEFF' + csvContent;
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContentComBOM);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'setores_maquinas.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function importFromCSV(event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const content = e.target.result;
        const rows = content.split("\n").map((row, index) => {
            return index === 0 ? row.replace(/^\uFEFF/, '') : row;
        });

        setores = [];
        setoresVisiveis = [];

        rows.forEach((row, index) => {
            if (index === 0 || !row.trim()) return;

            const cols = row.split(";");
            if (cols.length < 7) return;

            const setorNome = cols[0].replace(/"/g, '').trim();
            const maquinaTipo = cols[1].replace(/"/g, '').trim();
            const maquinaNome = cols[2].replace(/"/g, '').trim();
            const etiqueta = cols[3].replace(/"/g, '').trim();
            const emManutencao = cols[4].trim().toLowerCase() === 'true';
            const tempoManutencao = parseInt(cols[5].trim()) || 0;
            const usuarioResponsavel = cols[6].replace(/"/g, '').trim();
            const observacoesString = cols.slice(7).join(";").replace(/"/g, '').trim();

            let setor = setores.find(s => s.nome === setorNome);
            if (!setor) {
                setor = { nome: setorNome, maquinas: [] };
                setores.push(setor);
                setoresVisiveis.push(false);
            }

            const chamados = observacoesString && observacoesString !== "Nenhuma Observação"
                ? observacoesString.split(" | ").map(obs => {
                    const partes = obs.split(" - Prioridade: ");
                    return {
                        observacao: partes[0].trim(),
                        prioridade: partes[1]?.trim() || 'Normal'
                    };
                })
                : [];

           const id = cols[8]?.replace(/"/g, '').trim(); // nova coluna ID

const maquina = {
    id: id || crypto.randomUUID(), // gera um novo se não tiver
    nome: maquinaNome,
    tipo: maquinaTipo,
    etiqueta,
    chamado: chamados,
    emManutencao,
    tempoManutencao,
    usuarioResponsavel
};

            setor.maquinas.push(maquina);
        });

        saveSetoresAndMachines();
        renderSetores();
    };

    if (file) {
        reader.readAsText(file, 'UTF-8');
    }
}
