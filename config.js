// Configurações Estáticas globais (Injetadas em tempo de build ou alteradas manualmente)
window.ENV = {
    // URL do banco de dados (Pode ser local 'enxoval.db', uma URL HTTP, ou do Turso/libSQL 'libsql://...')
    DATABASE_URL: 'enxoval.db',

    // Token de autenticação do banco de dados (Opcional - necessário para bancos como o Turso)
    DATABASE_TOKEN: ''
};
