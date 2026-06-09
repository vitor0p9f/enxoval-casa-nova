/* ==========================================
   SQLITE (SQL.JS) & INDEXEDDB DATABASE MANAGER
   ========================================== */
let SQL = null;
let db = null;
let libsqlClient = null;

// Global App State
let appState = {
    sections: [],
    items: []
};

// Sub-state for building/editing the current item options in modal
let currentModalOptions = [];
let editingOptionId = null;

// IndexedDB Helper to persist raw SQLite binary blob
function saveToIndexedDB(binaryArray) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("EnxovalDB", 1);
        request.onupgradeneeded = e => {
            const db = e.target.result;
            db.createObjectStore("files");
        };
        request.onsuccess = e => {
            const db = e.target.result;
            const transaction = db.transaction("files", "readwrite");
            const store = transaction.objectStore("files");
            const putRequest = store.put(binaryArray, "sqliteFile");
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
        };
        request.onerror = () => reject(request.error);
    });
}

function loadFromIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("EnxovalDB", 1);
        request.onupgradeneeded = e => {
            const db = e.target.result;
            db.createObjectStore("files");
        };
        request.onsuccess = e => {
            const db = e.target.result;
            const transaction = db.transaction("files", "readonly");
            const store = transaction.objectStore("files");
            const getRequest = store.get("sqliteFile");
            getRequest.onsuccess = () => resolve(getRequest.result);
            getRequest.onerror = () => reject(getRequest.error);
        };
        request.onerror = () => resolve(null);
    });
}

async function initSqlDatabase() {
    if (libsqlClient) return;

    const dbUrl = window.ENV?.DATABASE_URL || 'enxoval.db';
    const dbToken = window.ENV?.DATABASE_TOKEN;

    // Se a URL iniciar com 'libsql://' ou se houver um token de banco de dados, tratamos como banco libSQL/Turso
    const isLibSQL = dbUrl.startsWith('libsql://') || !!dbToken;

    if (isLibSQL) {
        console.log("[*] Banco de dados remoto libSQL/Turso detectado. Inicializando cliente...");
        try {
            const { createClient } = await import("https://esm.sh/@libsql/client/web");
            libsqlClient = createClient({
                url: dbUrl,
                authToken: dbToken
            });
            console.log("[*] Cliente libSQL/Turso inicializado com sucesso.");
            return;
        } catch (e) {
            console.error("[!] Falha ao carregar o cliente do Turso/libSQL, usando fallback local:", e);
        }
    }

    if (SQL && db) return;
    try {
        const sqlJsConfig = {
            locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${filename}`
        };
        SQL = await initSqlJs(sqlJsConfig);
        
        let dbData = null;
        const dbUrl = window.ENV?.DATABASE_URL || 'enxoval.db';
        const isRemote = dbUrl.startsWith('http://') || dbUrl.startsWith('https://');
        
        // Tenta carregar remoto se configurado
        if (isRemote) {
            console.log(`[*] Buscando banco de dados remoto em: ${dbUrl}`);
            try {
                const response = await fetch(`${dbUrl}?t=${Date.now()}`); // cache-busting
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    dbData = new Uint8Array(arrayBuffer);
                    console.log("[*] Banco SQLite remoto carregado com sucesso.");
                }
            } catch (e) {
                console.warn("[!] Falha ao obter banco remoto, tentando cache local IndexedDB:", e);
            }
        }
        
        // Tenta carregar do IndexedDB local
        if (!dbData) {
            dbData = await loadFromIndexedDB();
        }
        
        // Tenta carregar arquivo estático local padrão se não achou no cache local e não é remoto
        if (!dbData && !isRemote) {
            console.log(`[*] Buscando banco estático local inicial de: ${dbUrl}`);
            try {
                const response = await fetch(dbUrl);
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    dbData = new Uint8Array(arrayBuffer);
                    console.log("[*] Banco SQLite padrão local carregado da URL.");
                }
            } catch (e) {
                console.warn("[!] Falha ao carregar banco padrão do servidor local:", e);
            }
        }
        
        if (dbData) {
            db = new SQL.Database(dbData);
            createDbTables();
        } else {
            console.log("[*] Nenhum banco de dados existente localizado. Criando novo.");
            db = new SQL.Database();
            createDbTables();
        }
    } catch (e) {
        console.error("Erro ao inicializar SQL.js, criando em memória virtual:", e);
        SQL = { Database: class { run() {} exec() { return []; } export() { return new Uint8Array(); } } };
        db = new SQL.Database();
    }
}

function createDbTables() {
    db.run(`
        CREATE TABLE IF NOT EXISTS sections (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            position INTEGER NOT NULL DEFAULT 0
        );
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS items (
            id TEXT PRIMARY KEY,
            section_id TEXT NOT NULL,
            name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            active_option_id TEXT,
            acquired_at TEXT,
            FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
        );
    `);
    try {
        db.run("ALTER TABLE items ADD COLUMN acquired_at TEXT;");
    } catch (e) {
        // Coluna já existe
    }
    db.run(`
        CREATE TABLE IF NOT EXISTS item_options (
            id TEXT PRIMARY KEY,
            item_id TEXT NOT NULL,
            store_name TEXT,
            price REAL,
            url TEXT,
            image_url TEXT,
            FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
        );
    `);
}

function seedDbData(state) {
    try {
        db.run("BEGIN TRANSACTION;");
        state.sections.forEach((sec, idx) => {
            db.run("INSERT OR REPLACE INTO sections (id, name, position) VALUES (?, ?, ?);", [sec.id, sec.name, idx]);
        });
        state.items.forEach(item => {
            db.run("INSERT OR REPLACE INTO items (id, section_id, name, status, active_option_id, acquired_at) VALUES (?, ?, ?, ?, ?, ?);", 
                [item.id, item.sectionId, item.name, item.status, item.activeOptionId, item.acquiredAt || null]);
            item.options.forEach(opt => {
                db.run("INSERT OR REPLACE INTO item_options (id, item_id, store_name, price, url, image_url) VALUES (?, ?, ?, ?, ?, ?);",
                    [opt.id, item.id, opt.storeName, opt.price, opt.url, opt.imageUrl]);
            });
        });
        db.run("COMMIT;");
        console.log("[*] Dados de exemplo semeados no SQLite com sucesso.");
    } catch (e) {
        db.run("ROLLBACK;");
        console.error("Erro ao semear dados:", e);
    }
}

function loadStateFromSql() {
    try {
        const sectionsResult = db.exec("SELECT * FROM sections ORDER BY position ASC;");
        const itemsResult = db.exec("SELECT * FROM items;");
        const optionsResult = db.exec("SELECT * FROM item_options;");
        
        const sections = [];
        if (sectionsResult.length > 0) {
            const columns = sectionsResult[0].columns;
            sectionsResult[0].values.forEach(row => {
                const sec = {};
                columns.forEach((col, idx) => {
                    sec[col] = row[idx];
                });
                sections.push({
                    id: sec.id,
                    name: sec.name,
                    position: sec.position
                });
            });
        }
        
        const itemsMap = {};
        if (itemsResult.length > 0) {
            const columns = itemsResult[0].columns;
            itemsResult[0].values.forEach(row => {
                const item = {};
                columns.forEach((col, idx) => {
                    item[col] = row[idx];
                });
                itemsMap[item.id] = {
                    id: item.id,
                    sectionId: item.section_id,
                    name: item.name,
                    status: item.status,
                    activeOptionId: item.active_option_id,
                    acquiredAt: item.acquired_at || null,
                    options: []
                };
            });
        }
        
        if (optionsResult.length > 0) {
            const columns = optionsResult[0].columns;
            optionsResult[0].values.forEach(row => {
                const opt = {};
                columns.forEach((col, idx) => {
                    opt[col] = row[idx];
                });
                if (itemsMap[opt.item_id]) {
                    itemsMap[opt.item_id].options.push({
                        id: opt.id,
                        storeName: opt.store_name,
                        price: opt.price,
                        url: opt.url,
                        imageUrl: opt.image_url
                    });
                }
            });
        }
        
        appState = {
            sections,
            items: Object.values(itemsMap)
        };
    } catch (e) {
        console.error("Erro ao carregar dados do SQLite:", e);
        appState = { sections: [], items: [] };
    }
}

async function loadStateFromTurso() {
    try {
        // Garantir tabelas criadas no Turso
        await libsqlClient.execute(`
            CREATE TABLE IF NOT EXISTS sections (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                position INTEGER NOT NULL DEFAULT 0
            );
        `);
        await libsqlClient.execute(`
            CREATE TABLE IF NOT EXISTS items (
                id TEXT PRIMARY KEY,
                section_id TEXT NOT NULL,
                name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                active_option_id TEXT,
                acquired_at TEXT,
                FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
            );
        `);
        try {
            await libsqlClient.execute("ALTER TABLE items ADD COLUMN acquired_at TEXT;");
        } catch (e) {
            // Coluna já existe
        }
        await libsqlClient.execute(`
            CREATE TABLE IF NOT EXISTS item_options (
                id TEXT PRIMARY KEY,
                item_id TEXT NOT NULL,
                store_name TEXT,
                price REAL,
                url TEXT,
                image_url TEXT,
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
            );
        `);

        // Semeia se estiver vazio
        const countRes = await libsqlClient.execute("SELECT COUNT(*) as count FROM sections;");
        const count = countRes.rows[0]?.count || 0;
        if (count === 0) {
            console.log("[*] Banco do Turso vazio.");
        }

        // Carrega os dados
        const sectionsResult = await libsqlClient.execute("SELECT * FROM sections ORDER BY position ASC;");
        const itemsResult = await libsqlClient.execute("SELECT * FROM items;");
        const optionsResult = await libsqlClient.execute("SELECT * FROM item_options;");

        const sections = sectionsResult.rows.map(row => ({
            id: row.id,
            name: row.name,
            position: row.position
        }));

        const itemsMap = {};
        itemsResult.rows.forEach(row => {
            itemsMap[row.id] = {
                id: row.id,
                sectionId: row.section_id,
                name: row.name,
                status: row.status,
                activeOptionId: row.active_option_id,
                acquiredAt: row.acquired_at || null,
                options: []
            };
        });

        optionsResult.rows.forEach(row => {
            if (itemsMap[row.item_id]) {
                itemsMap[row.item_id].options.push({
                    id: row.id,
                    storeName: row.store_name,
                    price: row.price,
                    url: row.url,
                    imageUrl: row.image_url
                });
            }
        });

        appState = {
            sections,
            items: Object.values(itemsMap)
        };
        console.log("[*] Dados carregados do Turso.");
    } catch (e) {
        console.error("Erro ao carregar dados do Turso:", e);
        appState = { sections: [], items: [] };
    }
}

async function saveStateToTurso() {
    if (!libsqlClient) return;
    try {
        console.log("[*] Salvando alterações no Turso...");
        const statements = [
            "DELETE FROM item_options;",
            "DELETE FROM items;",
            "DELETE FROM sections;"
        ];
        
        appState.sections.forEach((sec, idx) => {
            statements.push({
                sql: "INSERT INTO sections (id, name, position) VALUES (?, ?, ?);",
                args: [sec.id, sec.name, idx]
            });
        });
        
        appState.items.forEach(item => {
            statements.push({
                sql: "INSERT INTO items (id, section_id, name, status, active_option_id, acquired_at) VALUES (?, ?, ?, ?, ?, ?);",
                args: [item.id, item.sectionId, item.name, item.status, item.activeOptionId, item.acquiredAt || null]
            });
            
            item.options.forEach(opt => {
                statements.push({
                    sql: "INSERT INTO item_options (id, item_id, store_name, price, url, image_url) VALUES (?, ?, ?, ?, ?, ?);",
                    args: [opt.id, item.id, opt.storeName, opt.price, opt.url, opt.imageUrl]
                });
            });
        });
        
        await libsqlClient.batch(statements, "write");
        console.log("[*] Sincronização com o Turso concluída com sucesso.");
    } catch (e) {
        console.error("Erro ao salvar dados no Turso:", e);
    }
}

async function loadState() {
    await initSqlDatabase();
    if (libsqlClient) {
        await loadStateFromTurso();
    } else {
        loadStateFromSql();
    }
}

async function saveState() {
    if (libsqlClient) {
        await saveStateToTurso();
        return;
    }
    if (!db) return;
    try {
        db.run("BEGIN TRANSACTION;");
        db.run("DELETE FROM item_options;");
        db.run("DELETE FROM items;");
        db.run("DELETE FROM sections;");
        
        appState.sections.forEach((sec, idx) => {
            db.run("INSERT INTO sections (id, name, position) VALUES (?, ?, ?);", [sec.id, sec.name, idx]);
        });
        
        appState.items.forEach(item => {
            db.run("INSERT INTO items (id, section_id, name, status, active_option_id, acquired_at) VALUES (?, ?, ?, ?, ?, ?);",
                [item.id, item.sectionId, item.name, item.status, item.activeOptionId, item.acquiredAt || null]);
            
            item.options.forEach(opt => {
                db.run("INSERT INTO item_options (id, item_id, store_name, price, url, image_url) VALUES (?, ?, ?, ?, ?, ?);",
                    [opt.id, item.id, opt.storeName, opt.price, opt.url, opt.imageUrl]);
            });
        });
        
        db.run("COMMIT;");
        
        const binaryArray = db.export();
        // Persiste no IndexedDB localmente
        await saveToIndexedDB(binaryArray);
        console.log("[*] Banco SQLite salvo localmente.");
        
        // Sincroniza remotamente se configurado
        const dbUrl = window.ENV?.DATABASE_URL || 'enxoval.db';
        const isRemote = dbUrl.startsWith('http://') || dbUrl.startsWith('https://');
        if (isRemote) {
            console.log(`[*] Sincronizando banco com servidor remoto: ${dbUrl}`);
            try {
                const response = await fetch(dbUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-sqlite3'
                    },
                    body: binaryArray
                });
                if (response.ok) {
                    console.log("[*] Banco SQLite remoto sincronizado.");
                } else {
                    console.warn("[!] Erro do servidor ao salvar banco remoto:", response.statusText);
                }
            } catch (e) {
                console.error("[!] Erro de conexão ao salvar banco remoto:", e);
            }
        }
    } catch (e) {
        db.run("ROLLBACK;");
        console.error("Erro ao salvar dados no SQLite:", e);
    }
}

function downloadSqliteFile() {
    if (!db) {
        alert("Banco de dados SQLite ainda não inicializado.");
        return;
    }
    const binaryArray = db.export();
    const blob = new Blob([binaryArray], { type: "application/x-sqlite3" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'enxoval.db';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
