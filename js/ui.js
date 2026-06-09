/* ==========================================
   RENDER & UI INTERACTION FUNCTIONS
   ========================================== */

function setGlobalLoading(isLoading) {
    const ids = ['add-section-btn', 'add-item-btn', 'search-input', 'download-db-btn', 'export-btn', 'import-btn-trigger'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = isLoading;
    });

    const container = document.getElementById('sections-container');
    if (isLoading && container) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; align-self: stretch; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 1rem; color: var(--text-muted); min-height: 300px; height: 100%;">
                <span class="spinner" style="display: inline-block; width: 40px; height: 40px; border-width: 4px; border-color: var(--primary) transparent transparent transparent; margin-bottom: 1.5rem;"></span>
                <p style="font-size: 1.1rem; font-family: 'Playfair Display', serif; font-style: italic; color: var(--text-dark);">Buscando os dados do enxoval...</p>
            </div>
        `;
    }
}

function renderAll() {
    renderChecklist();
    renderDashboard();
    lucide.createIcons();
}

// Render the Checklist Page (Page 2)
function renderChecklist() {
    const container = document.getElementById('sections-container');
    if (!container) return;

    container.innerHTML = '';
    const searchQuery = document.getElementById('search-input')?.value.toLowerCase().trim() || '';

    const addItemBtn = document.getElementById('add-item-btn');
    if (addItemBtn) {
        addItemBtn.disabled = appState.sections.length === 0;
        addItemBtn.style.opacity = appState.sections.length === 0 ? '0.5' : '1';
        addItemBtn.style.cursor = appState.sections.length === 0 ? 'not-allowed' : 'pointer';
    }

    if (appState.sections.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-checklist-state';
        emptyState.innerHTML = `
            <h3 style="color: var(--text-dark); font-size: 1.8rem; margin-bottom: 0.5rem; font-family: 'Playfair Display', serif; font-style: italic;">O nosso lar começa aqui</h3>
            <p style="color: var(--text-muted); font-size: 0.95rem;">Clique em <span style="color: var(--secondary); font-weight: 600;">Nova seção</span> para começar a organizar os detalhes.</p>
        `;
        container.appendChild(emptyState);
    }

    appState.sections.forEach(section => {
        // Filter items belonging to this section
        let sectionItems = appState.items.filter(item => item.sectionId === section.id);
        
        // Apply search query filter
        if (searchQuery) {
            sectionItems = sectionItems.filter(item => item.name.toLowerCase().includes(searchQuery));
        }

        // Section Card Element
        const sectionCard = document.createElement('div');
        sectionCard.className = 'section-card';
        sectionCard.setAttribute('data-section-id', section.id);
        
        // Header
        const header = document.createElement('div');
        header.className = 'section-card-header';
        
        // Section drag handle (grip icon)
        const dragHandle = document.createElement('div');
        dragHandle.className = 'section-drag-handle';
        dragHandle.setAttribute('draggable', 'true');
        dragHandle.innerHTML = '<i data-lucide="grip-vertical"></i>';
        
        const titleWrap = document.createElement('div');
        titleWrap.className = 'section-card-title-wrap';
        
        const title = document.createElement('h3');
        title.className = 'section-card-title';
        title.innerText = section.name;
        
        const count = document.createElement('span');
        count.className = 'section-item-count';
        count.innerText = `${sectionItems.filter(i => i.status === 'acquired').length}/${sectionItems.length}`;
        
        titleWrap.appendChild(title);
        titleWrap.appendChild(count);
        
        // Actions (Rename, Delete)
        const actions = document.createElement('div');
        actions.className = 'section-actions';
        
        const renameBtn = document.createElement('button');
        renameBtn.className = 'icon-btn';
        renameBtn.innerHTML = '<i data-lucide="edit-3"></i>';
        renameBtn.title = 'Renomear seção';
        renameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openSectionModal(section.id, section.name);
        });
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'icon-btn delete';
        deleteBtn.innerHTML = '<i data-lucide="trash-2"></i>';
        deleteBtn.title = 'Excluir seção';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDeleteSection(section.id, section.name);
        });
        
        actions.appendChild(renameBtn);
        actions.appendChild(deleteBtn);
        
        header.appendChild(dragHandle);
        header.appendChild(titleWrap);
        header.appendChild(actions);
        sectionCard.appendChild(header);

        // Items Container
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'items-container';
        itemsContainer.setAttribute('data-section-id', section.id);

        if (sectionItems.length === 0) {
            const placeholder = document.createElement('div');
            placeholder.className = 'empty-placeholder';
            placeholder.innerHTML = '<i data-lucide="inbox"></i> Vazio. Arraste itens ou adicione novos.';
            itemsContainer.appendChild(placeholder);
        } else {
            sectionItems.forEach(item => {
                // Determine price and active option info
                const activeOpt = item.options.find(o => o.id === item.activeOptionId) || item.options[0];
                const priceStr = activeOpt ? `R$ ${activeOpt.price.toFixed(2).replace('.', ',')}` : 'Sob consulta';
                const storeStr = activeOpt ? activeOpt.storeName : '';
                const optionsCount = item.options.length;

                // Item Card Element
                const itemCard = document.createElement('div');
                itemCard.className = `item-card ${item.status === 'acquired' ? 'acquired' : ''}`;
                itemCard.setAttribute('data-item-id', item.id);
                itemCard.addEventListener('click', () => {
                    openItemModal(item.id);
                });

                // Checkbox
                const checkbox = document.createElement('div');
                checkbox.className = 'item-checkbox';
                checkbox.innerHTML = '<i data-lucide="check"></i>';
                checkbox.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleItemStatus(item.id);
                });

                // Details Text
                const details = document.createElement('div');
                details.className = 'item-details';
                
                const name = document.createElement('div');
                name.className = 'item-name';
                name.innerText = item.name;
                
                const meta = document.createElement('div');
                meta.className = 'item-meta';
                
                const priceSpan = document.createElement('span');
                priceSpan.className = 'item-price';
                priceSpan.innerText = priceStr;
                
                meta.appendChild(priceSpan);
                
                if (storeStr) {
                    const storeSpan = document.createElement('span');
                    storeSpan.innerText = `• ${storeStr}`;
                    meta.appendChild(storeSpan);
                }
                
                if (optionsCount > 1) {
                    const badge = document.createElement('span');
                    badge.className = 'item-badge';
                    badge.innerText = `${optionsCount} opções`;
                    meta.appendChild(badge);
                }

                if (item.status === 'acquired' && item.acquiredAt) {
                    const dateSpan = document.createElement('span');
                    dateSpan.className = 'item-acquired-date';
                    dateSpan.innerHTML = `<i data-lucide="calendar"></i> ${item.acquiredAt}`;
                    meta.appendChild(dateSpan);
                }
                
                details.appendChild(name);
                details.appendChild(meta);

                // Drag Handle (6 pontinhos)
                const dragGrip = document.createElement('div');
                dragGrip.className = 'item-drag-handle';
                dragGrip.innerHTML = '<i data-lucide="grip-vertical"></i>';
                dragGrip.addEventListener('click', (e) => {
                    e.stopPropagation();
                });

                itemCard.appendChild(checkbox);
                itemCard.appendChild(details);
                itemCard.appendChild(dragGrip);
                
                itemsContainer.appendChild(itemCard);
            });
        }

        sectionCard.appendChild(itemsContainer);

        // Add item inline button
        const addInlineBtn = document.createElement('button');
        addInlineBtn.className = 'add-item-inline-btn';
        addInlineBtn.innerHTML = '<i data-lucide="plus"></i> Novo item';
        addInlineBtn.addEventListener('click', () => {
            openItemModal(null, section.id);
        });
        sectionCard.appendChild(addInlineBtn);

        container.appendChild(sectionCard);
    });

    setupDragAndDrop();
    lucide.createIcons();
}

// Render the Dashboard Page (Page 3)
function renderDashboard() {
    const totalItems = appState.items.length;
    const checkedItems = appState.items.filter(i => i.status === 'acquired').length;
    const totalSections = appState.sections.length;
    
    // Total price calculation based on active (or first) option
    let totalPrice = 0;
    appState.items.forEach(item => {
        const activeOpt = item.options.find(o => o.id === item.activeOptionId) || item.options[0];
        if (activeOpt && typeof activeOpt.price === 'number') {
            totalPrice += activeOpt.price;
        }
    });

    // Update simple card values
    document.getElementById('stat-total-items').innerText = totalItems;
    document.getElementById('stat-total-sections').innerText = totalSections;
    document.getElementById('stat-total-price').innerText = `R$ ${totalPrice.toFixed(2).replace('.', ',')}`;

    // Progress bar percent
    const progressPercent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;
    document.getElementById('stat-checked-items').innerHTML = `${checkedItems} <span class="metric-sub">(${progressPercent}%)</span>`;
    document.getElementById('general-progress-label').innerText = `${progressPercent}%`;
    document.getElementById('general-progress-fill').style.width = `${progressPercent}%`;

    // Render detailed breakdown table
    const tableBody = document.getElementById('dashboard-breakdown-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    
    if (appState.sections.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Nenhuma seção cadastrada.</td></tr>';
        return;
    }

    appState.sections.forEach(section => {
        const sectionItems = appState.items.filter(i => i.sectionId === section.id);
        const sectionTotal = sectionItems.length;
        const sectionChecked = sectionItems.filter(i => i.status === 'acquired').length;
        
        let sectionPrice = 0;
        sectionItems.forEach(item => {
            const activeOpt = item.options.find(o => o.id === item.activeOptionId) || item.options[0];
            if (activeOpt && typeof activeOpt.price === 'number') {
                sectionPrice += activeOpt.price;
            }
        });

        const percent = sectionTotal > 0 ? Math.round((sectionChecked / sectionTotal) * 100) : 0;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight: 600;">${section.name}</td>
            <td>${sectionTotal} item(ns)</td>
            <td>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span>${percent}%</span>
                    <div class="progress-bar-bg" style="flex: 1; height: 6px; min-width: 60px;">
                        <div class="progress-bar-fill" style="width: ${percent}%; height: 100%;"></div>
                    </div>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">(${sectionChecked}/${sectionTotal})</span>
                </div>
            </td>
            <td style="font-weight: 600; color: var(--primary);">R$ ${sectionPrice.toFixed(2).replace('.', ',')}</td>
        `;
        tableBody.appendChild(row);
    });
}

let pendingUncheckItemId = null;

function openConfirmUncheckModal(itemId) {
    const item = appState.items.find(i => i.id === itemId);
    if (!item) return;

    pendingUncheckItemId = itemId;
    const nameEl = document.getElementById('uncheck-item-name');
    if (nameEl) nameEl.innerText = item.name;
    document.getElementById('confirm-uncheck-modal').classList.add('open');
}

function closeConfirmUncheckModal() {
    document.getElementById('confirm-uncheck-modal').classList.remove('open');
    pendingUncheckItemId = null;
}

async function handleConfirmUncheckSubmit() {
    if (pendingUncheckItemId) {
        const item = appState.items.find(i => i.id === pendingUncheckItemId);
        if (item) {
            item.status = 'pending';
            item.acquiredAt = null;
            await saveState();
            renderAll();
        }
    }
    closeConfirmUncheckModal();
}

async function toggleItemStatus(itemId) {
    const item = appState.items.find(i => i.id === itemId);
    if (item) {
        if (item.status === 'acquired') {
            openConfirmUncheckModal(itemId);
        } else {
            item.status = 'acquired';
            item.acquiredAt = new Date().toLocaleDateString('pt-BR');
            await saveState();
            renderAll();
        }
    }
}

/* ==========================================
   SECTION MODAL LOGIC
   ========================================== */
function openSectionModal(id = null, name = '') {
    const modal = document.getElementById('section-modal');
    const title = document.getElementById('section-modal-title');
    const input = document.getElementById('section-name-input');
    const hiddenId = document.getElementById('edit-section-id');

    hiddenId.value = id || '';
    input.value = name || '';
    title.innerText = id ? 'Editar seção' : 'Nova seção';

    modal.classList.add('open');
    input.focus();
}

function closeSectionModal() {
    document.getElementById('section-modal').classList.remove('open');
    document.getElementById('section-form').reset();
}

async function handleSectionSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-section-id').value;
    const name = document.getElementById('section-name-input').value.trim();

    if (!name) return;

    if (id) {
        // Edit existing
        const section = appState.sections.find(s => s.id === id);
        if (section) section.name = name;
    } else {
        // Create new
        const newId = 'sec-' + Date.now();
        appState.sections.push({ id: newId, name: name });
    }

    await saveState();
    closeSectionModal();
    renderAll();
}

async function handleDeleteSection(id, name) {
    if (confirm(`Deseja realmente excluir a seção "${name}"? Todos os itens dela serão excluídos permanentemente.`)) {
        // Filter out section
        appState.sections = appState.sections.filter(s => s.id !== id);
        // Filter out items in this section
        appState.items = appState.items.filter(i => i.sectionId !== id);
        
        await saveState();
        renderAll();
    }
}

/* ==========================================
   ITEM MODAL LOGIC
   ========================================== */
function openItemModal(itemId = null, defaultSectionId = null) {
    const modal = document.getElementById('item-modal');
    const modalTitle = document.getElementById('modal-item-title');
    const form = document.getElementById('item-form');
    
    // Clear scraper fields
    hideOptionEditorPanel();
    clearScraperAlert();
    document.getElementById('option-link-input').value = '';

    // Populate Section Select dropdown
    const select = document.getElementById('item-section-select');
    select.innerHTML = '';
    appState.sections.forEach(sec => {
        const opt = document.createElement('option');
        opt.value = sec.id;
        opt.innerText = sec.name;
        select.appendChild(opt);
    });

    const deleteBtn = document.getElementById('delete-item-btn');
    const sectionSelectGroup = select.closest('.form-group');

    if (itemId) {
        // EDIT MODE
        const item = appState.items.find(i => i.id === itemId);
        if (!item) return;

        modalTitle.innerText = 'Editar item';
        document.getElementById('edit-item-id').value = item.id;
        document.getElementById('item-name-input').value = item.name;
        document.getElementById('item-section-select').value = item.sectionId;
        document.getElementById('item-status-select').value = item.status;
        
        if (sectionSelectGroup) sectionSelectGroup.style.display = '';
        currentModalOptions = JSON.parse(JSON.stringify(item.options)); // Clone options
        deleteBtn.style.display = 'inline-flex';
    } else {
        // CREATE MODE
        modalTitle.innerText = 'Adicionar novo item';
        form.reset();
        document.getElementById('edit-item-id').value = '';
        
        if (defaultSectionId) {
            document.getElementById('item-section-select').value = defaultSectionId;
            if (sectionSelectGroup) sectionSelectGroup.style.display = 'none';
        } else {
            if (appState.sections.length > 0) {
                document.getElementById('item-section-select').value = appState.sections[0].id;
            }
            if (sectionSelectGroup) sectionSelectGroup.style.display = '';
        }

        document.getElementById('item-status-select').value = 'pending';
        currentModalOptions = [];
        deleteBtn.style.display = 'none';
    }

    renderModalOptionsList(itemId ? appState.items.find(i => i.id === itemId).activeOptionId : null);
    modal.classList.add('open');
}

function closeItemModal() {
    document.getElementById('item-modal').classList.remove('open');
    document.getElementById('item-form').reset();
    currentModalOptions = [];
}

async function handleItemSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-item-id').value;
    const name = document.getElementById('item-name-input').value.trim();
    const sectionId = document.getElementById('item-section-select').value;
    const status = document.getElementById('item-status-select').value;

    if (!name || !sectionId) return;

    // We need at least one option, or we create a default empty option so the item has a value
    if (currentModalOptions.length === 0) {
        currentModalOptions.push({
            id: 'opt-def-' + Date.now(),
            storeName: 'Indefinido',
            price: 0,
            url: '',
            imageUrl: ''
        });
    }

    // Use the active option stored in the DOM (selected via radio buttons)
    let activeOptionId = document.getElementById('options-list-container')?.getAttribute('data-active-opt-id');
    
    if (!activeOptionId || !currentModalOptions.some(o => o.id === activeOptionId)) {
        activeOptionId = currentModalOptions[0]?.id;
    }

    if (id) {
        // Update item
        const item = appState.items.find(i => i.id === id);
        if (item) {
            if (item.status !== 'acquired' && status === 'acquired') {
                item.acquiredAt = new Date().toLocaleDateString('pt-BR');
            } else if (item.status === 'acquired' && status === 'pending') {
                item.acquiredAt = null;
            }
            item.name = name;
            item.sectionId = sectionId;
            item.status = status;
            item.options = currentModalOptions;
            item.activeOptionId = activeOptionId;
        }
    } else {
        // Create new
        const newItem = {
            id: 'item-' + Date.now(),
            name: name,
            sectionId: sectionId,
            status: status,
            options: currentModalOptions,
            activeOptionId: activeOptionId,
            acquiredAt: status === 'acquired' ? new Date().toLocaleDateString('pt-BR') : null
        };
        appState.items.push(newItem);
    }

    await saveState();
    closeItemModal();
    renderAll();
}

async function handleDeleteItem() {
    const id = document.getElementById('edit-item-id').value;
    const name = document.getElementById('item-name-input').value;
    if (id && confirm(`Excluir permanentemente o item "${name}"?`)) {
        appState.items = appState.items.filter(i => i.id !== id);
        await saveState();
        closeItemModal();
        renderAll();
    }
}

function saveCurrentOption() {
    const storeName = document.getElementById('opt-name').value.trim() || 'Loja';
    const priceVal = parseFloat(document.getElementById('opt-price').value) || 0;
    const imageUrl = document.getElementById('opt-image').value.trim();
    const url = document.getElementById('option-link-input').value.trim();

    if (editingOptionId) {
        // Edit existing option in list
        const opt = currentModalOptions.find(o => o.id === editingOptionId);
        if (opt) {
            opt.storeName = storeName;
            opt.price = priceVal;
            opt.imageUrl = imageUrl;
            if (url) opt.url = url;
        }
    } else {
        // Add new option
        const newOpt = {
            id: 'opt-' + Date.now(),
            storeName: storeName,
            price: priceVal,
            url: url,
            imageUrl: imageUrl
        };
        currentModalOptions.push(newOpt);
    }

    // Reset scraper search box
    document.getElementById('option-link-input').value = '';
    
    hideOptionEditorPanel();
    clearScraperAlert();
    renderModalOptionsList();
}

// Render options list inside Item Modal
function renderModalOptionsList(activeId = null) {
    const listContainer = document.getElementById('options-list-container');
    const primaryImgContainer = document.getElementById('primary-option-preview-container');
    listContainer.innerHTML = '';

    if (currentModalOptions.length === 0) {
        listContainer.innerHTML = '<div style="font-size: 0.82rem; color: var(--text-muted); text-align: center; padding: 1rem 0;">Nenhum link adicionado ainda.</div>';
        if (primaryImgContainer) primaryImgContainer.style.display = 'none';
        return;
    }
    
    if (primaryImgContainer) primaryImgContainer.style.display = 'flex';

    // If no active option is defined, set default to first
    let currentActiveId = activeId;
    if (!currentActiveId || !currentModalOptions.some(o => o.id === currentActiveId)) {
        currentActiveId = currentModalOptions[0].id;
    }

    currentModalOptions.forEach(opt => {
        const card = document.createElement('div');
        card.className = `option-item-card ${opt.id === currentActiveId ? 'is-active' : ''}`;
        
        // Option Radio selector
        const radio = document.createElement('div');
        radio.className = 'option-active-indicator';
        radio.innerHTML = '<i data-lucide="check"></i>';
        radio.addEventListener('click', () => {
            renderModalOptionsList(opt.id);
        });

        // Image thumb
        const img = document.createElement('img');
        img.className = 'option-img-thumb';
        img.src = opt.imageUrl || 'assets/cozy_home_illustration.png'; // Fallback to our cover art
        img.onerror = () => { img.src = 'assets/cozy_home_illustration.png'; }; // Handles broken links

        // Details
        const details = document.createElement('div');
        details.className = 'option-text-details';
        
        const titleRow = document.createElement('div');
        titleRow.className = 'option-title-row';
        
        const name = document.createElement('span');
        name.className = 'option-title-name';
        name.innerText = opt.storeName;
        
        const price = document.createElement('span');
        price.className = 'option-title-price';
        price.innerText = `R$ ${opt.price.toFixed(2).replace('.', ',')}`;
        
        titleRow.appendChild(name);
        titleRow.appendChild(price);
        
        const actionsRow = document.createElement('div');
        actionsRow.className = 'option-actions-row';
        
        if (opt.url) {
            const link = document.createElement('a');
            link.className = 'option-link-tag';
            link.href = opt.url;
            link.target = '_blank';
            link.innerHTML = 'Ver loja <i data-lucide="external-link" style="width:10px; height:10px;"></i>';
            actionsRow.appendChild(link);
        } else {
            actionsRow.appendChild(document.createElement('div'));
        }

        const deleteOptBtn = document.createElement('button');
        deleteOptBtn.type = 'button';
        deleteOptBtn.className = 'delete-opt-btn';
        deleteOptBtn.innerText = 'Excluir';
        deleteOptBtn.addEventListener('click', () => {
            deleteOptionFromModal(opt.id, currentActiveId);
        });
        actionsRow.appendChild(deleteOptBtn);

        details.appendChild(titleRow);
        details.appendChild(actionsRow);

        card.appendChild(radio);
        card.appendChild(img);
        card.appendChild(details);

        listContainer.appendChild(card);
    });

    // Save active choice temporarily in the form
    listContainer.setAttribute('data-active-opt-id', currentActiveId);
    
    // Update image preview for primary option
    const primaryImgEl = document.getElementById('primary-option-img');
    if (primaryImgEl) {
        const activeOptObj = currentModalOptions.find(o => o.id === currentActiveId);
        if (activeOptObj && activeOptObj.imageUrl) {
            primaryImgEl.src = activeOptObj.imageUrl;
        } else {
            primaryImgEl.src = 'assets/cozy_home_illustration.png';
        }
    }
    
    // Initialize icons in modal options
    lucide.createIcons();
}

function deleteOptionFromModal(optionId, currentActiveId) {
    currentModalOptions = currentModalOptions.filter(o => o.id !== optionId);
    let nextActiveId = currentActiveId === optionId ? null : currentActiveId;
    renderModalOptionsList(nextActiveId);
}

/* ==========================================
   BACKUP DATA (EXPORT / IMPORT)
   ========================================== */
function handleDataExport() {
    try {
        const jsonStr = JSON.stringify(appState, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `enxoval_vitor_maiara_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch(e) {
        alert("Erro ao exportar dados.");
        console.error(e);
    }
}

function handleDataImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(evt) {
        try {
            const imported = JSON.parse(evt.target.result);
            
            // Basic schema validation
            if (Array.isArray(imported.sections) && Array.isArray(imported.items)) {
                appState = imported;
                await saveState();
                renderAll();
                alert("Dados importados com sucesso!");
            } else {
                alert("O arquivo JSON não parece ser um backup válido do enxoval.");
            }
        } catch(err) {
            alert("Erro ao ler o arquivo JSON.");
            console.error(err);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}
