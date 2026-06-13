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
    flowCopy: document.querySelector(".flow-copy"),
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

  function factValue(node, label) {
    return node.facts.find((fact) => fact.label === label)?.value;
  }

  function uniqueList(items) {
    return [...new Set(items.filter(Boolean))];
  }

  function nodeLabel(id) {
    return nodeById.get(id)?.label;
  }

  function compactList(items, limit) {
    const values = uniqueList(items);
    if (values.length <= limit) return values.join("、");
    return `${values.slice(0, limit).join("、")}など`;
  }

  function incomingEdgesTo(id) {
    return edges.filter((edge) => edge.to === id);
  }

  function detailIntro(node, outgoing, incoming) {
    const type = typeById.get(node.type)?.label || "技";
    const entries = compactList(incoming.map((edge) => nodeLabel(edge.from)), 4);
    const exits = compactList(outgoing.map((edge) => nodeLabel(edge.to)), 4);

    if (entries && exits) {
      return `${node.label}は${type}として、${entries}から入り、${exits}へ展開しやすい位置づけです。${node.summary}`;
    }

    if (exits) {
      return `${node.label}は${type}として、ここから${exits}へ展開するための起点です。${node.summary}`;
    }

    if (entries) {
      return `${node.label}は${type}として、${entries}からつながる終着点または攻撃の区切りです。${node.summary}`;
    }

    return `${node.label}は${type}として扱うノードです。${node.summary}`;
  }

  function detailAction(node, outgoing) {
    const purpose = factValue(node, "目的");
    const entry = factValue(node, "入口");
    const attack = factValue(node, "攻撃");
    const point = factValue(node, "要点");
    const exit = factValue(node, "出口");
    const next = compactList(outgoing.map((edge) => edge.label || nodeLabel(edge.to)), 3);

    if (point) return `何をするか: ${point}。${entry ? `主な入口は${entry}です。` : ""}`;
    if (purpose) return `何をするか: ${purpose}。${next ? `次は${next}を狙います。` : ""}`;
    if (attack) return `何をするか: ${attack}を作るために相手の姿勢、腕、首、脚のどれかを孤立させます。`;
    if (exit) return `何をするか: ${exit}へ出るために相手のベースやフレームを崩します。`;
    return `何をするか: 相手の姿勢や支点を変化させ、自分に有利な次の選択肢を作ります。`;
  }

  function detailWatch(node, incoming) {
    const caution = factValue(node, "注意");
    const uses = factValue(node, "使う場面");
    const source = compactList(incoming.map((edge) => edge.label), 3);

    if (caution && uses) return `見るポイント: ${uses}で使いやすく、${caution}`;
    if (caution) return `見るポイント: ${caution}`;
    if (source) return `見るポイント: ${source}の流れで相手の反応を見て、無理に形だけを追わないこと。`;
    return "見るポイント: 形よりも、相手の重心・姿勢・逃げ道がどこにあるかを確認します。";
  }

  function renderDetails(node) {
    let panel = document.querySelector("[data-detail-panel]");
    if (!panel) {
      panel = document.createElement("section");
      panel.className = "detail-panel";
      panel.setAttribute("data-detail-panel", "");
      dom.flowCopy.append(panel);
    }

    const outgoing = edgesFrom(node.id);
    const incoming = incomingEdgesTo(node.id);
    const detailItems = [
      { label: "全体像", value: detailIntro(node, outgoing, incoming) },
      { label: "動きの意味", value: detailAction(node, outgoing) },
      { label: "確認ポイント", value: detailWatch(node, incoming) },
    ];

    panel.innerHTML = "";
    detailItems.forEach((item) => {
      const block = document.createElement("div");
      const title = document.createElement("h2");
      const text = document.createElement("p");

      title.textContent = item.label;
      text.textContent = item.value;
      block.append(title, text);
      panel.append(block);
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

    document.title = `WAZAMAP - ${node.label}`;
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
    renderDetails(node);
    renderBranches(node);
    renderPicker(node.id);
  }

  dom.picker.addEventListener("change", (event) => {
    window.location.href = nodeUrl(event.target.value);
  });

  renderNode(nodeById.get(requestedNodeId()));
})();
