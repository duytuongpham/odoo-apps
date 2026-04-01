/** @odoo-module */

import {patch} from "@web/core/utils/patch";
import {ListRenderer} from "@web/views/list/list_renderer";
import {onMounted, onPatched, onWillUnmount} from "@odoo/owl";

function syncFilterRowWidths(tableEl) {
    if (!tableEl) {
        return;
    }
    const thead = tableEl.querySelector("thead");
    if (!thead) {
        return;
    }
    const headerRow = thead.querySelector("tr:first-child");
    const filterRow = thead.querySelector("tr.o_mns_o2m_column_filters");
    if (!headerRow || !filterRow) {
        return;
    }
    const headerCells = [...headerRow.children];
    const filterCells = [...filterRow.children];
    const n = Math.min(headerCells.length, filterCells.length);
    for (let i = 0; i < n; i++) {
        const w = headerCells[i].getBoundingClientRect().width;
        if (w && Number.isFinite(w)) {
            const px = `${Math.round(w)}px`;
            const cell = filterCells[i];
            cell.style.width = px;
            cell.style.maxWidth = px;
            cell.style.minWidth = "0";
        }
    }
}

patch(ListRenderer.prototype, {
    setup() {
        super.setup(...arguments);
        let ro = null;

        const doSync = () => {
            const tableEl = this.tableRef?.el;
            if (!tableEl) {
                return;
            }
            requestAnimationFrame(() => {
                syncFilterRowWidths(tableEl);
                requestAnimationFrame(() => syncFilterRowWidths(tableEl));
            });
        };

        onMounted(() => {
            doSync();
            const tableEl = this.tableRef?.el;
            if (tableEl && typeof ResizeObserver !== "undefined") {
                ro = new ResizeObserver(() => doSync());
                ro.observe(tableEl);
            }
        });

        onPatched(() => {
            doSync();
        });

        onWillUnmount(() => {
            if (ro) {
                ro.disconnect();
                ro = null;
            }
        });
    },
});

