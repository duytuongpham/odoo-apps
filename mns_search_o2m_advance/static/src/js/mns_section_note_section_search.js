/** @odoo-module */

import {Component, useState} from "@odoo/owl";
import {_t} from "@web/core/l10n/translation";
import {debounce} from "@web/core/utils/timing";

function stripHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }
    const str = String(value);
    if (typeof document !== "undefined") {
        const d = document.createElement("div");
        d.innerHTML = str;
        return (d.textContent || "").trim();
    }
    return str.replace(/<[^>]*>/g, "").trim();
}

function toLowerSafe(v) {
    return (v || "").toString().toLowerCase();
}

export function mnsComputeSectionNoteBlocks(list) {
    const ids = [...(list.resIds || [])];
    const blocks = [];
    let preSectionIds = [];
    let current = null;

    for (const id of ids) {
        const rec = list._cache?.[id];
        const dt = rec?.data?.display_type;
        if (dt === "line_section") {
            if (current) {
                blocks.push(current);
            }
            current = {
                sectionId: id,
                label: stripHtml(rec.data?.name),
                lineIds: [id],
            };
        } else if (current) {
            current.lineIds.push(id);
        } else {
            preSectionIds.push(id);
        }
    }
    if (current) {
        blocks.push(current);
    }
    if (preSectionIds.length) {
        blocks.unshift({
            sectionId: "__pre_section__",
            label: "",
            lineIds: preSectionIds,
        });
    }
    return blocks;
}

export class MnsSectionNoteSectionSearch extends Component {
    static template = "mns_search_o2m_advance.MnsSectionNoteSectionSearch";
    static props = {
        list: {type: Object},
        nbCols: {type: Number},
    };

    setup() {
        this.state = useState({term: ""});
        this.applyDebounced = debounce(() => this.applyFilterImmediate(), 320);
    }

    get placeholder() {
        return _t("Filter by section title…");
    }

    onInput(ev) {
        this.state.term = ev.target.value || "";
        this.applyDebounced();
    }

    async clearFilter() {
        this.state.term = "";
        await this.applyFilterImmediate();
    }

    async applyFilterImmediate() {
        const list = this.props.list;
        if (!list?.load) {
            return;
        }
        const term = toLowerSafe(this.state.term).trim();

        if (!term) {
            list._mnsSectionNoteRestrictedIds = null;
        } else {
            const blocks = mnsComputeSectionNoteBlocks(list);
            const matched = new Set();
            for (const block of blocks) {
                if (toLowerSafe(block.label).includes(term)) {
                    for (const id of block.lineIds) {
                        matched.add(id);
                    }
                }
            }
            list._mnsSectionNoteRestrictedIds = [...matched];
        }

        if (list.leaveEditMode) {
            await list.leaveEditMode();
        }
        await list.load({offset: 0, limit: list.limit});
    }
}
