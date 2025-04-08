// Função para abrir o seletor de arquivos para importação
function importFromCSVButton() {
    document.getElementById('csvInput').click();
}

function exportToCSV() {
    let csvContent = "Setor;Tipo;Nome da Máquina;Etiqueta;Em Manutenção;Tempo de Manutenção;Observações;Prioridade\n";

    setores.forEach(setor => {
        setor.maquinas.forEach(maquina => {
            const observacoes = maquina.chamado.map(chamado => `"${chamado.observacao} - Prioridade: ${chamado.prioridade}"`).join(" | ") || "Nenhuma Observação";
            const row = `"${setor.nome}";"${maquina.tipo}";"${maquina.nome}";"${maquina.etiqueta || 'Sem etiqueta'}";${maquina.emManutencao};${maquina.tempoManutencao};"${observacoes}"\n`;
            csvContent += row;
        });
    });

    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'setores_maquinas.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}





// Função para importar o CSV e adicionar setores e máquinas
function importFromCSV(event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const content = e.target.result;
        const rows = content.split("\n");

        setores = [];
        setoresVisiveis = [];

        rows.forEach((row, index) => {
            if (index === 0 || !row.trim()) return;

            const cols = row.split(";");

            const setorNome = cols[0].replace(/"/g, '').trim();
            const maquinaTipo = cols[1].replace(/"/g, '').trim(); // corrige aqui
            const maquinaNome = cols[2].replace(/"/g, '').trim(); // e aqui
            const etiqueta = cols[3].trim();
            const emManutencao = cols[4].trim() === 'true';
            const tempoManutencao = parseInt(cols[5].trim()) || 0;
            const observacoes = cols[6].replace(/"/g, '').trim();
            
            
            let setor = setores.find(s => s.nome === setorNome);
            if (!setor) {
                setor = { nome: setorNome, maquinas: [] };
                setores.push(setor);
                setoresVisiveis.push(false);
            }

            const maquina = {
                nome: maquinaNome,
                tipo: maquinaTipo,
                etiqueta: cols[1].trim(),
                chamado: observacoes ? [{ observacao: observacoes, prioridade: 'Normal' }] : [],
                emManutencao,
                tempoManutencao,
            };

            setor.maquinas.push(maquina);
        });

        saveSetoresAndMachines();
        renderSetores();
    };

    reader.readAsText(file);
}
