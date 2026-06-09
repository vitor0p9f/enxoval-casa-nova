/* ==========================================
   LINK SCRAPER LOGIC (CLIENT SIDE VIA PROXY)
   ========================================== */
async function handleLinkScrape() {
    const urlInput = document.getElementById('option-link-input');
    const url = urlInput.value.trim();
    
    if (!url) {
        showScraperAlert("Por favor, cole um link válido.", "error");
        return;
    }

    // Basic URL validation
    try {
        new URL(url);
    } catch (e) {
        showScraperAlert("Por favor, digite um link de URL válido.", "error");
        return;
    }

    // UI Loading state
    const btn = document.getElementById('scrape-btn');
    const spinner = document.getElementById('scrape-spinner');
    const btnText = document.getElementById('scrape-btn-text');
    
    btn.disabled = true;
    spinner.style.display = 'inline-block';
    btnText.innerText = 'Buscando...';
    clearScraperAlert();

    // Call client-side meta parser
    const result = await parseExternalMetadata(url);

    // Reset UI state
    btn.disabled = false;
    spinner.style.display = 'none';
    btnText.innerText = 'Importar Link';

    if (result.success) {
        showScraperAlert("Dados importados com sucesso! Revise os detalhes abaixo antes de salvar.", "success");
        showOptionEditorPanel(result);
        
        // Auto fill item name if empty
        const itemNameInput = document.getElementById('item-name-input');
        if (!itemNameInput.value.trim()) {
            itemNameInput.value = result.title;
        }
    } else {
        showScraperAlert("Não foi possível puxar os dados automaticamente. Mas você pode digitar manualmente abaixo!", "error");
        // Show empty panel for manual input with store name preset
        let storePreset = "Loja";
        try { storePreset = new URL(url).hostname.replace('www.', '').split('.')[0]; } catch(e){}
        storePreset = storePreset.charAt(0).toUpperCase() + storePreset.slice(1);

        showOptionEditorPanel({
            title: '',
            imageUrl: '',
            price: 0,
            storeName: storePreset,
            url: url
        });
    }
}

// Scraper strategy
async function parseExternalMetadata(url) {
    try {
        let storeName = "Loja";
        let title = "";
        let imageUrl = "";
        let price = null;
        let domain = "";

        try {
            const parsedUrl = new URL(url);
            domain = parsedUrl.hostname.replace('www.', '');
            storeName = domain.split('.')[0];
            storeName = storeName.charAt(0).toUpperCase() + storeName.slice(1);
        } catch(e){}

        // Disparar requests em paralelo para Microlink e Proxy
        const microlinkUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        
        const [microRes, proxyRes] = await Promise.allSettled([
            fetch(microlinkUrl),
            fetch(proxyUrl)
        ]);

        let doc = null;

        // 1. MICROLINK DATA (Título, Imagem, Loja) - Fonte primária
        if (microRes.status === 'fulfilled' && microRes.value.ok) {
            try {
                const mlData = await microRes.value.json();
                if (mlData.status === 'success' && mlData.data) {
                    if (mlData.data.title) title = mlData.data.title;
                    if (mlData.data.image?.url) imageUrl = mlData.data.image.url;
                    else if (mlData.data.logo?.url) imageUrl = mlData.data.logo.url;
                    
                    if (mlData.data.publisher) storeName = mlData.data.publisher;
                }
            } catch(e) {
                console.warn("Microlink parse error", e);
            }
        }

        // 2. RAW HTML DATA (Para Preço e Fallbacks)
        if (proxyRes.status === 'fulfilled' && proxyRes.value.ok) {
            try {
                const proxyData = await proxyRes.value.json();
                if (proxyData.contents) {
                    const parser = new DOMParser();
                    doc = parser.parseFromString(proxyData.contents, "text/html");
                }
            } catch(e) {
                console.warn("Proxy parse error", e);
            }
        }

        // 3. EXTRAÇÃO DE PREÇO & FALLBACKS VIA DOM PARSER
        if (doc) {
            // Helpers
            const resolveUrl = (path) => {
                if (!path) return "";
                try { return new URL(path, url).href; } 
                catch (e) { return path; }
            };

            const getMetaContent = (selectors) => {
                for (let sel of selectors) {
                    const el = doc.querySelector(sel);
                    if (el) {
                        const content = el.getAttribute("content") || el.getAttribute("value") || el.getAttribute("href");
                        if (content) return content.trim();
                    }
                }
                return null;
            };

            // Title Fallback se Microlink falhar
            if (!title) {
                if (domain.includes('amazon')) {
                    const amzTitle = doc.querySelector('#productTitle');
                    if (amzTitle) title = amzTitle.innerText;
                } else if (domain.includes('mercadolivre')) {
                    const mlTitle = doc.querySelector('.ui-pdp-title');
                    if (mlTitle) title = mlTitle.innerText;
                }
                if (!title) {
                    title = getMetaContent([
                        'meta[property="og:title"]', 'meta[name="og:title"]',
                        'meta[name="twitter:title"]', 'meta[property="twitter:title"]',
                        'meta[itemprop="name"]', 'meta[name="title"]'
                    ]);
                }
                if (!title) {
                    const titleTag = doc.querySelector('title');
                    if (titleTag) title = titleTag.innerText;
                }
            }

            // Sempre limpar sujeiras do titulo
            if (title) {
                title = title.split(" | ")[0].split(" - ")[0].split(" : ")[0].trim();
                const removeBrands = ["Amazon.com.br", "Mercado Livre", "Magazine Luiza", "Magalu", "Shopee"];
                removeBrands.forEach(brand => {
                    const reg = new RegExp(`\\s*[,\\-–]\\s*${brand}`, 'gi');
                    title = title.replace(reg, '').trim();
                });
            }

            // Image Fallback se Microlink falhar
            if (!imageUrl) {
                if (domain.includes('amazon')) {
                    const amzImg = doc.querySelector('#landingImage') || doc.querySelector('#imgBlkFront');
                    if (amzImg) imageUrl = amzImg.getAttribute('data-old-hires') || amzImg.getAttribute('src');
                } else if (domain.includes('mercadolivre')) {
                    const mlImg = doc.querySelector('.ui-pdp-gallery__figure__image') || doc.querySelector('.ui-pdp-image');
                    if (mlImg) imageUrl = mlImg.getAttribute('src') || mlImg.getAttribute('data-zoom');
                }

                if (!imageUrl) {
                    imageUrl = getMetaContent([
                        'meta[property="og:image:secure_url"]', 'meta[property="og:image"]', 
                        'meta[name="og:image"]', 'meta[name="twitter:image"]', 
                        'meta[property="twitter:image"]', 'meta[itemprop="image"]', 
                        'link[rel="image_src"]', 'link[rel="apple-touch-icon"]'
                    ]);
                }
                if (!imageUrl) {
                    const imgs = Array.from(doc.querySelectorAll('img'));
                    const goodImg = imgs.find(img => {
                        const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
                        return src && !src.includes('logo') && !src.includes('icon') && !src.includes('banner') && !src.includes('sprite');
                    });
                    if (goodImg) imageUrl = goodImg.getAttribute('src') || goodImg.getAttribute('data-src');
                }
                if (imageUrl) imageUrl = resolveUrl(imageUrl);
            }

            // ============================================
            // EXTRAÇÃO DE PREÇO (Requerido DOM Parsing)
            // ============================================
            const parsePriceString = (str) => {
                if (!str) return null;
                let cleanStr = str.replace(/R\$/gi, '').trim();
                
                if (/^\d+(\.\d{1,2})?$/.test(cleanStr)) return parseFloat(cleanStr);

                if (cleanStr.includes(',') && cleanStr.includes('.')) {
                    cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
                } else if (cleanStr.includes(',')) {
                    const parts = cleanStr.split(',');
                    if (parts[1] && parts[1].trim().length <= 2) {
                        cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
                    } else {
                        cleanStr = cleanStr.replace(/,/g, '');
                    }
                }
                
                const parsed = parseFloat(cleanStr.replace(/[^0-9.]/g, ''));
                return (!isNaN(parsed) && parsed > 0) ? parsed : null;
            };

            // A: Selectors
            if (domain.includes('amazon')) {
                const selectors = ['.a-price .a-offscreen', '#priceblock_ourprice', '#priceblock_dealprice', '#corePrice_feature_div .a-offscreen'];
                for (let sel of selectors) {
                    const el = doc.querySelector(sel);
                    if (el && el.innerText) {
                        price = parsePriceString(el.innerText);
                        if (price) break;
                    }
                }
            } else if (domain.includes('mercadolivre')) {
                const metaPrice = doc.querySelector('meta[property="product:price:amount"]');
                if (metaPrice) price = parseFloat(metaPrice.getAttribute("content"));
                if (!price) {
                    const fraction = doc.querySelector('.andes-money-amount__fraction');
                    const cents = doc.querySelector('.andes-money-amount__cents');
                    if (fraction) {
                        let priceText = fraction.innerText;
                        if (cents) priceText += `,${cents.innerText}`;
                        price = parsePriceString(priceText);
                    }
                }
            } else if (domain.includes('magazinevoce') || domain.includes('magazineluiza') || domain.includes('magalu')) {
                const magaluPrice = doc.querySelector('[data-testid="price-value"]');
                if (magaluPrice) price = parsePriceString(magaluPrice.innerText);
            }

            // B: Tags
            if (!price) {
                const priceContent = getMetaContent([
                    'meta[property="product:price:amount"]', 'meta[name="product:price:amount"]',
                    'meta[property="og:price:amount"]', 'meta[name="og:price:amount"]',
                    'meta[itemprop="price"]', 'meta[name="price"]', 'meta[property="price"]'
                ]);
                if (priceContent) price = parsePriceString(priceContent);
                
                if (!price) {
                    const priceEls = doc.querySelectorAll('[itemprop="price"]');
                    for (let el of priceEls) {
                        const content = el.getAttribute("content") || el.innerText;
                        if (content) {
                            price = parsePriceString(content);
                            if (price) break;
                        }
                    }
                }
            }

            // C: JSON-LD
            if (!price) {
                const jsonLds = doc.querySelectorAll('script[type="application/ld+json"]');
                for (let script of jsonLds) {
                    try {
                        const json = JSON.parse(script.innerText);
                        const findOffers = (obj) => {
                            if (!obj || typeof obj !== 'object') return null;
                            if (obj.offers) return obj.offers;
                            if (obj['@graph']) {
                                for (let node of obj['@graph']) {
                                    if (node.offers) return node.offers;
                                    if (node['@type'] === 'Product' && node.offers) return node.offers;
                                }
                            }
                            if (obj['@type'] === 'Product' && obj.offers) return obj.offers;
                            for (let k in obj) {
                                const res = findOffers(obj[k]);
                                if (res) return res;
                            }
                            return null;
                        };
                        const offers = findOffers(json);
                        if (offers) {
                            const offerList = Array.isArray(offers) ? offers : [offers];
                            for (let offer of offerList) {
                                const p = offer.price || offer.lowPrice || offer.highPrice;
                                if (p) {
                                    const parsed = parseFloat(p.toString().replace(/[^0-9.]/g, ''));
                                    if (!isNaN(parsed) && parsed > 0) {
                                        price = parsed;
                                        break;
                                    }
                                }
                            }
                        }
                        if (price) break;
                    } catch(e){}
                }
            }

            // D & E: Texto Bruto
            if (!price) {
                const textToSearch = doc.body ? doc.body.innerText : proxyData.contents;
                const rxBr = /R\$\s*([0-9.]+,\d{2})/i;
                const match = textToSearch.match(rxBr);
                if (match) price = parsePriceString(match[0]);
            }
        }

        // Se nem microlink nem proxy retornaram nada, dispara erro para fallback manual
        if (!title && !doc) {
            throw new Error("Não foi possível acessar a URL");
        }

        return {
            success: true,
            title: title || "Produto Importado",
            imageUrl: imageUrl || "",
            price: price || 0,
            storeName: storeName,
            url: url
        };

    } catch (e) {
        console.warn("Parsing meta tags failed, falling back to manual: ", e);
        return { success: false };
    }
}

// Option Editor Panel Actions
function showOptionEditorPanel(data = null, isEdit = false) {
    const panel = document.getElementById('option-editor-panel');
    panel.style.display = 'flex';

    if (data && !isEdit) {
        document.getElementById('opt-name').value = data.storeName;
        document.getElementById('opt-price').value = data.price > 0 ? data.price : '';
        document.getElementById('opt-image').value = data.imageUrl;
        editingOptionId = null;
        document.getElementById('save-option-btn').innerText = 'Adicionar Opção';
    } else if (data && isEdit) {
        document.getElementById('opt-name').value = data.storeName || '';
        document.getElementById('opt-price').value = data.price > 0 ? data.price : '';
        document.getElementById('opt-image').value = data.imageUrl || '';
        editingOptionId = data.id;
        document.getElementById('save-option-btn').innerText = 'Salvar Alterações';
    } else {
        document.getElementById('opt-name').value = '';
        document.getElementById('opt-price').value = '';
        document.getElementById('opt-image').value = '';
        editingOptionId = null;
        document.getElementById('save-option-btn').innerText = 'Adicionar Opção';
    }
}

function hideOptionEditorPanel() {
    document.getElementById('option-editor-panel').style.display = 'none';
    document.getElementById('opt-name').value = '';
    document.getElementById('opt-price').value = '';
    document.getElementById('opt-image').value = '';
    editingOptionId = null;
}

function showScraperAlert(text, type) {
    const alertBox = document.getElementById('scraper-status-message');
    alertBox.className = `scraper-alert ${type}`;
    alertBox.innerText = text;
    alertBox.style.display = 'block';
}

function clearScraperAlert() {
    const alertBox = document.getElementById('scraper-status-message');
    alertBox.style.display = 'none';
    alertBox.innerText = '';
}
