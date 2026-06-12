(function () {
  const data = window.BJJ_FLOW_DATA;
  const groups = data.groups;
  const types = data.types;
  const nodes = data.nodes;
  const edges = data.edges;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const typeById = new Map(types.map((type) => [type.id, type]));

  const dom = {
    body: document.body,
    title: document.querySelector("[data-title]"),
    typeLabel: document.querySelector("[data-type-label]"),
    summary: document.querySelector("[data-summary]"),
    facts: document.querySelector("[data-facts]"),
    branchPanel: document.querySelector(".branch-panel"),
    branchLabel: document.querySelector("[data-branch-label]"),
    ghostWord: document.querySelector("[data-ghost-word]"),
    drawing: document.querySelector("[data-line-drawing]"),
    groupLabel: document.querySelector("[data-group-label]"),
    nodeLabel: document.querySelector("[data-node-label]"),
    picker: document.querySelector("[data-node-picker]"),
  };

  function nodeUrl(id) {
    return `index.html?node=${encodeURIComponent(id)}`;
  }

  function requestedNodeId() {
    const params = new URLSearchParams(window.location.search);
    const queryId = params.get("node") || params.get("workflow");
    const hashId = window.location.hash.replace("#", "");

    if (nodeById.has(queryId)) return queryId;
    if (nodeById.has(hashId)) return hashId;
    return data.defaultNodeId;
  }

  function edgesFrom(id) {
    return edges.filter((edge) => edge.from === id);
  }

  function incomingEdgesFor(id, outgoing) {
    const outgoingTargets = new Set(outgoing.map((edge) => edge.to));

    return edges
      .filter((edge) => edge.to === id && edge.from !== id && !outgoingTargets.has(edge.from))
      .slice(0, data.maxIncomingHints || 4)
      .map((edge) => ({
        from: id,
        to: edge.from,
        label: `${nodeById.get(edge.from).label}へ戻る`,
        summary: "この技やポジションへ入る前の文脈を確認する。",
        relation: "関連",
        muted: true,
      }));
  }

  function renderPicker(currentId) {
    dom.picker.innerHTML = "";

    groups.forEach((group) => {
      const groupNodes = nodes.filter((node) => node.group === group.id);
      if (!groupNodes.length) return;

      const optgroup = document.createElement("optgroup");
      optgroup.label = group.label;

      groupNodes.forEach((node) => {
        const option = document.createElement("option");
        option.value = node.id;
        option.textContent = node.label;
        option.selected = node.id === currentId;
        optgroup.append(option);
      });

      dom.picker.append(optgroup);
    });
  }

  function renderFacts(node) {
    dom.facts.innerHTML = "";

    node.facts.forEach((fact) => {
      const item = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");

      term.textContent = fact.label;
      description.textContent = fact.value;

      item.append(term, description);
      dom.facts.append(item);
    });
  }

  function renderBranches(node) {
    dom.branchPanel.querySelectorAll(".branch").forEach((branch) => branch.remove());
    dom.branchLabel.textContent = "次に選べる流れ";

    const outgoing = edgesFrom(node.id);
    const fallback =
      outgoing.length > 0
        ? []
        : [
            {
              from: node.id,
              to: data.defaultNodeId,
              label: "最初の立ち位置へ戻る",
              summary: "一本を取った後の再開、または全体像の確認に戻る。",
              relation: "リセット",
              primary: true,
            },
          ];
    const incomingHints =
      outgoing.length >= (data.incomingHintThreshold || 5) ? [] : incomingEdgesFor(node.id, outgoing);
    const branchEdges = [...outgoing, ...fallback, ...incomingHints];

    branchEdges.forEach((edge, index) => {
      const target = nodeById.get(edge.to);
      if (!target) return;

      const link = document.createElement("a");
      const indexEl = document.createElement("span");
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      const summary = document.createElement("small");
      const relation = document.createElement("span");

      link.className = "branch";
      if (edge.primary || index === 0) link.classList.add("branch-primary");
      if (edge.muted) link.classList.add("branch-muted");
      link.href = nodeUrl(edge.to);
      link.dataset.nodeTarget = edge.to;

      indexEl.className = "branch-index";
      indexEl.textContent = String(index + 1).padStart(2, "0");
      title.textContent = edge.label || target.title;
      summary.textContent = edge.summary || target.summary;
      relation.className = "branch-kind";
      relation.textContent = edge.relation || typeById.get(target.type)?.label || "移行";

      copy.append(title, summary);
      link.append(indexEl, copy, relation);
      dom.branchPanel.append(link);
    });
  }

  function renderDrawing(node) {
    const drawing = data.drawings[node.drawing] || data.drawings.flow;

    dom.drawing.setAttribute("viewBox", drawing.viewBox);
    dom.drawing.className.baseVal = `line-drawing ${drawing.className}`;
    dom.drawing.innerHTML = drawing.markup;
  }

  function renderNode(node) {
    const group = groupById.get(node.group);
    const type = typeById.get(node.type);

    document.title = `BJJ Flow - ${node.label}`;
    dom.body.className = `theme-${node.theme}`;
    dom.title.textContent = node.title;
    dom.summary.textContent = node.summary;
    dom.typeLabel.textContent = type?.label || "ノード";
    dom.groupLabel.textContent = group?.label || "柔術";
    dom.nodeLabel.textContent = node.label;
    dom.ghostWord.textContent = node.backgroundWord || node.label;
    dom.ghostWord.className = `ghost-word ${node.ghostClass || "ghost-cjk"}`.trim();

    renderDrawing(node);
    renderFacts(node);
    renderBranches(node);
    renderPicker(node.id);
  }

  dom.picker.addEventListener("change", (event) => {
    window.location.href = nodeUrl(event.target.value);
  });

  renderNode(nodeById.get(requestedNodeId()));
})();
