# Backup de rollback — Home com pastas (antes do dashboard)

Este arquivo guarda o trecho anterior da Home e da funcao `renderFolders()` para facilitar retorno rapido caso voce nao goste do dashboard novo.

## 1) Trecho antigo da Home (index.html)

```html
<!-- ══ HOME VIEW ══ -->
<div class="view show" id="homeView">
  <div class="homeBody">
    <div style="font-family:'Space Grotesk',sans-serif;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,.28);padding:16px 6px 12px;display:none;">Acesso Rápido</div>
    <div class="folderGrid" id="folderGrid"></div>
  </div>
</div>
```

## 2) Trecho antigo da renderizacao da Home

```js
function renderFolders(){
  const grid=document.getElementById('folderGrid');
  grid.innerHTML='';
  const byId=Object.fromEntries(state.folders.map(f=>[f.id,f]));
  SYSTEM_IDS.forEach(id=>{ if(!state.folderOrder.includes(id)&&state.folders.find(f=>f.id===id)) state.folderOrder.push(id); });
  const order=(state.folderOrder||[]).filter((id,i,a)=>a.indexOf(id)===i&&byId[id]);
  state.folders.forEach(f=>{if(!order.includes(f.id))order.push(f.id);});
  const topLevel=order.filter(id=>byId[id]&&!byId[id].parentId);

  // Pastas da frente: usa homeFolders se definido, senão usa SYSTEM_IDS (padrão)
  let homeIds = state.homeFolders && state.homeFolders.length > 0
    ? state.homeFolders.filter(id=>byId[id])
    : SYSTEM_IDS.filter(id=>byId[id]);

  // Garante que só mostra no máximo 7 (8ª célula é o botão +)
  const visible = homeIds.slice(0, 7);

  visible.forEach(id=>{
    const f=byId[id]; if(!f) return;
    const children=state.folders.filter(c=>c.parentId===id);
    grid.appendChild(makeTile(f, false, children));
  });

  // Botão "+" — 8ª célula
  const plusBtn = document.createElement('div');
  plusBtn.className = 'folderTile';
  plusBtn.innerHTML = `
    <div class="fi-wrap" style="background:rgba(249,115,22,.12);border:2px dashed rgba(249,115,22,.55);">
      <div class="fi" style="font-size:26px;font-weight:900;color:rgba(249,115,22,.9);line-height:1;">+</div>
    </div>
    <div class="fl" style="color:rgba(249,115,22,.75);">Mais</div>
  `;
  plusBtn.addEventListener('click', openTodasPastas);
  grid.appendChild(plusBtn);
}
```

## 3) Como voltar rapido

1. Restaurar o bloco HTML antigo da Home.
2. Restaurar a versao antiga de `renderFolders()`.
3. Remover chamadas e estilos do dashboard.

