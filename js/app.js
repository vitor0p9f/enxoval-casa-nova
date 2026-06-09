/* ==========================================
   ENTRYPOINT & EVENT LISTENERS
   ========================================== */

document.addEventListener('DOMContentLoaded', async () => {
    initScrollDots();
    initEventListeners();
    await loadState();
    renderAll();
});

function initScrollDots() {
    const navDots = document.querySelectorAll('.nav-dot');
    
    // Smooth scroll on click
    navDots.forEach(dot => {
        dot.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = dot.getAttribute('data-target');
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Detect current scroll section
    const observerOptions = {
        root: null,
        rootMargin: '-30% 0px -30% 0px', // Trigger when section occupies the center area
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                navDots.forEach(dot => {
                    if (dot.getAttribute('data-target') === id) {
                        dot.classList.add('active');
                    } else {
                        dot.classList.remove('active');
                    }
                });
            }
        });
    }, observerOptions);

    document.querySelectorAll('.page-section').forEach(section => {
        observer.observe(section);
    });
}

function initEventListeners() {
    // Scroll down Cover button
    const scrollDownBtn = document.getElementById('scroll-down-btn');
    if (scrollDownBtn) {
        scrollDownBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('checklist-page').scrollIntoView({ behavior: 'smooth' });
        });
    }

    // Search bar
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderChecklist();
        });
    }

    // Modal Add Section Triggers
    const addSectionBtn = document.getElementById('add-section-btn');
    if (addSectionBtn) {
        addSectionBtn.addEventListener('click', () => openSectionModal());
    }
    document.getElementById('close-section-modal-btn').addEventListener('click', () => closeSectionModal());
    document.getElementById('cancel-section-btn').addEventListener('click', () => closeSectionModal());
    document.getElementById('section-form').addEventListener('submit', handleSectionSubmit);

    // Modal Add Item Triggers
    const addItemBtn = document.getElementById('add-item-btn');
    if (addItemBtn) {
        addItemBtn.addEventListener('click', () => openItemModal());
    }
    document.getElementById('close-item-modal-btn').addEventListener('click', () => closeItemModal());
    document.getElementById('cancel-item-btn').addEventListener('click', () => closeItemModal());
    document.getElementById('delete-item-btn').addEventListener('click', handleDeleteItem);
    document.getElementById('item-form').addEventListener('submit', handleItemSubmit);

    // Modal Confirm Uncheck Triggers
    document.getElementById('close-confirm-uncheck-btn').addEventListener('click', () => closeConfirmUncheckModal());
    document.getElementById('cancel-uncheck-btn').addEventListener('click', () => closeConfirmUncheckModal());
    document.getElementById('confirm-uncheck-btn-submit').addEventListener('click', handleConfirmUncheckSubmit);

    // Option Scraper Triggers
    document.getElementById('scrape-btn').addEventListener('click', handleLinkScrape);
    document.getElementById('cancel-option-btn').addEventListener('click', hideOptionEditorPanel);
    document.getElementById('save-option-btn').addEventListener('click', saveCurrentOption);

    // Backup Triggers
    document.getElementById('export-btn').addEventListener('click', handleDataExport);
    const importTrigger = document.getElementById('import-btn-trigger');
    const importFileInput = document.getElementById('import-file-input');
    if (importTrigger && importFileInput) {
        importTrigger.addEventListener('click', () => importFileInput.click());
        importFileInput.addEventListener('change', handleDataImport);
    }

    // Botão de download do Banco SQLite (.db)
    const downloadDbBtn = document.getElementById('download-db-btn');
    if (downloadDbBtn) {
        downloadDbBtn.addEventListener('click', () => {
            downloadSqliteFile();
        });
    }
}

/* ==========================================
   DRAG AND DROP HANDLERS (VANILLA)
   ========================================== */
let draggedType = null; // 'item' ou 'section'
let draggedId = null;

function setupDragAndDrop() {
    const itemCards = document.querySelectorAll('.item-card');
    const containers = document.querySelectorAll('.items-container');
    const sectionDragHandles = document.querySelectorAll('.section-drag-handle');

    // 1. Drag & Drop para Itens
    itemCards.forEach(card => {
        const handle = card.querySelector('.item-drag-handle');
        if (handle) {
            handle.addEventListener('mousedown', () => {
                card.setAttribute('draggable', 'true');
            });
            handle.addEventListener('touchstart', () => {
                card.setAttribute('draggable', 'true');
            });
            handle.addEventListener('mouseup', () => {
                card.setAttribute('draggable', 'false');
            });
        }

        card.addEventListener('dragstart', (e) => {
            draggedType = 'item';
            draggedId = card.getAttribute('data-item-id');
            card.classList.add('dragging');
            e.dataTransfer.setData('text/plain', draggedId);
            e.dataTransfer.effectAllowed = 'move';
        });

        card.addEventListener('dragend', async () => {
            card.setAttribute('draggable', 'false');
            card.classList.remove('dragging');
            draggedType = null;
            draggedId = null;

            // Reordena os itens no appState com base na ordem atual do DOM
            const newItemsOrder = [];
            document.querySelectorAll('.section-card').forEach(secCard => {
                const sectionId = secCard.getAttribute('data-section-id');
                secCard.querySelectorAll('.item-card').forEach(itemCard => {
                    const itemId = itemCard.getAttribute('data-item-id');
                    const item = appState.items.find(i => i.id === itemId);
                    if (item) {
                        item.sectionId = sectionId;
                        newItemsOrder.push(item);
                    }
                });
            });

            // Mantém quaisquer itens não visíveis (ex: filtrados na busca)
            appState.items.forEach(item => {
                if (!newItemsOrder.some(i => i.id === item.id)) {
                    newItemsOrder.push(item);
                }
            });

            appState.items = newItemsOrder;
            await saveState();
            renderAll();
        });
    });

    containers.forEach(container => {
        container.addEventListener('dragover', (e) => {
            if (draggedType !== 'item') return;
            e.preventDefault();
            
            const afterElement = getDragAfterElement(container, e.clientY);
            const draggable = document.querySelector('.dragging');
            if (draggable) {
                if (afterElement == null) {
                    container.appendChild(draggable);
                } else {
                    container.insertBefore(draggable, afterElement);
                }
            }
        });
    });

    // 2. Drag & Drop para Seções
    sectionDragHandles.forEach(handle => {
        handle.addEventListener('dragstart', (e) => {
            draggedType = 'section';
            const card = handle.closest('.section-card');
            if (!card) return;
            draggedId = card.getAttribute('data-section-id');
            card.classList.add('dragging-section');
            e.dataTransfer.setData('text/plain', draggedId);
            e.dataTransfer.effectAllowed = 'move';
        });

        handle.addEventListener('dragend', async () => {
            const card = handle.closest('.section-card');
            if (card) {
                card.classList.remove('dragging-section');
            }
            draggedType = null;
            draggedId = null;

            // Reordena as seções no appState com base na ordem atual do DOM
            const newSectionsOrder = [];
            document.querySelectorAll('.section-card').forEach(secCard => {
                const sectionId = secCard.getAttribute('data-section-id');
                const sec = appState.sections.find(s => s.id === sectionId);
                if (sec) {
                    newSectionsOrder.push(sec);
                }
            });

            appState.sections.forEach(sec => {
                if (!newSectionsOrder.some(s => s.id === sec.id)) {
                    newSectionsOrder.push(sec);
                }
            });

            appState.sections = newSectionsOrder;
            await saveState();
            renderAll();
        });
    });

    const sectionsContainer = document.getElementById('sections-container');
    if (sectionsContainer) {
        sectionsContainer.addEventListener('dragover', (e) => {
            if (draggedType !== 'section') return;
            e.preventDefault();
            
            const afterElement = getDragAfterSectionElement(sectionsContainer, e.clientY);
            const draggable = document.querySelector('.dragging-section');
            if (draggable) {
                if (afterElement == null) {
                    sectionsContainer.appendChild(draggable);
                } else {
                    sectionsContainer.insertBefore(draggable, afterElement);
                }
            }
        });
    }
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.item-card:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function getDragAfterSectionElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.section-card:not(.dragging-section)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}
