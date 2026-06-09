// Configurações Estáticas globais (Injetadas em tempo de build ou alteradas manualmente)
window.ENV = {
    // URL do banco de dados (Pode ser local 'enxoval.db', uma URL HTTP, ou do Turso/libSQL 'libsql://...')
    // Para configurar via GitHub Actions no deploy do GH Pages, você pode rodar no workflow:
    // sed -i "s|'enxoval.db'|'${{ secrets.DATABASE_URL }}'|g" config.js
    DATABASE_URL: 'enxoval.db',

    // Token de autenticação do banco de dados (Opcional - necessário para bancos como o Turso)
    DATABASE_TOKEN: ''
};
