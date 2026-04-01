/** @odoo-module */

import {Component, useState} from "@odoo/owl";
import {_t} from "@web/core/l10n/translation";
import {debounce} from "@web/core/utils/timing";
import {useService} from "@web/core/utils/hooks";
import {Many2XAutocomplete} from "@web/views/fields/relational_utils";
import {TagsList} from "@web/core/tags_list/tags_list";

function toLowerSafe(v) {
    return (v || "").toString().toLowerCase();
}

export class MnsO2mAdvanceHeaderFilters extends Component {
    static template = "mns_search_o2m_advance.MnsO2mAdvanceHeaderFilters";
    static components = {Many2XAutocomplete, TagsList};
    static props = {
        list: {type: Object},
        columns: {type: Array},
        hasSelectors: {type: Boolean, optional: true},
        hasOpenFormViewColumn: {type: Boolean, optional: true},
        hasActionsColumn: {type: Boolean, optional: true},
    };

    setup() {
        this.orm = useService("orm");
        this.state = useState({
            textValues: {},
            booleanValues: {},
            selectionValues: {},
            many2oneValues: {},
            many2manyValues: {},
            dateFromValues: {},
            dateToValues: {},
            numberFromValues: {},
            numberToValues: {},
        });

        this.applyDebounced = debounce(() => this.applyFilters(), 350);
    }

    getField(column) {
        if (!column || column.type !== "field") {
            return null;
        }
        return this.props.list.fields?.[column.name] || null;
    }

    getActiveFieldInfo(column) {
        if (!column || column.type !== "field") {
            return null;
        }
        return this.props.list.activeFields?.[column.name] || null;
    }

    getFieldType(column) {
        const field = this.getField(column);
        return field?.type || column.fieldType || null;
    }

    getColumnName(column) {
        return column?.name;
    }

    isSupportedFieldType(column) {
        const t = this.getFieldType(column);
        const field = this.getField(column);
        const fieldName = column?.name;

        if (fieldName === "sequence" || fieldName === "seq" || fieldName === "stt") {
            return false;
        }
        if (field && field.store === false) {
            return false;
        }
        return [
            "char",
            "text",
            "boolean",
            "selection",
            "many2one",
            "many2many",
            "date",
            "datetime",
            "integer",
            "float",
            "monetary",
        ].includes(t);
    }

    formatDateForAdvanceDomain(dateStr) {
        const raw = (dateStr || "").toString();
        if (!raw) {
            return null;
        }
        const dateOnly = raw.split("T")[0];
        const parts = dateOnly.split("-");
        if (parts.length !== 3) {
            return null;
        }
        const [yyyy, mm, dd] = parts;
        if (!yyyy || !mm || !dd) {
            return null;
        }
        return `${yyyy}/${mm}/${dd} 00:00:00`;
    }

    getMany2oneProps(column) {
        const fieldName = this.getColumnName(column);
        const field = this.getField(column);
        const resModel = field?.relation;
        if (!resModel) {
            return null;
        }
        const selected = this.state.many2oneValues[fieldName] || [];
        const selectedIds = selected.map((x) => x.id);

        return {
            id: `mns_adv_filter_${fieldName}`,
            resModel,
            fieldString: column.label,
            activeActions: {create: false, createEdit: false, write: false, link: true},
            getDomain: () => [],
            searchLimit: 8,
            searchMoreLimit: 40,
            noSearchMore: false,
            quickCreate: null,
            autoSelect: false,
            dropdown: true,
            context: {},
            nameCreateField: "name",
            setInputFloats: () => {},
            update: (val) => this.onMany2oneUpdated(fieldName, val),
            isToMany: true,
        };
    }

    getMany2manyProps(column) {
        const fieldName = this.getColumnName(column);
        const field = this.getField(column);
        const resModel = field?.relation;
        if (!resModel) {
            return null;
        }
        return {
            id: `mns_adv_filter_${fieldName}`,
            resModel,
            fieldString: column.label,
            activeActions: {create: false, createEdit: false, write: false, link: true},
            getDomain: () => [],
            searchLimit: 8,
            searchMoreLimit: 40,
            noSearchMore: false,
            quickCreate: null,
            autoSelect: false,
            dropdown: true,
            context: {},
            nameCreateField: "name",
            setInputFloats: () => {},
            update: (val) => this.onMany2manyUpdated(fieldName, val),
            isToMany: true,
        };
    }

    onTextInput(fieldName, value) {
        this.state.textValues[fieldName] = value;
        this.applyDebounced();
    }

    onNumberFromChanged(fieldName, value) {
        this.state.numberFromValues[fieldName] = value ?? "";
        this.applyFilters();
    }

    onNumberToChanged(fieldName, value) {
        this.state.numberToValues[fieldName] = value ?? "";
        this.applyFilters();
    }

    clearNumberRange(fieldName) {
        this.state.numberFromValues[fieldName] = "";
        this.state.numberToValues[fieldName] = "";
        this.applyFilters();
    }

    onDateFromChanged(fieldName, value) {
        this.state.dateFromValues[fieldName] = value || "";
        this.applyFilters();
    }

    onDateToChanged(fieldName, value) {
        this.state.dateToValues[fieldName] = value || "";
        this.applyFilters();
    }

    clearDateRange(fieldName) {
        this.state.dateFromValues[fieldName] = "";
        this.state.dateToValues[fieldName] = "";
        this.applyFilters();
    }

    onBooleanChanged(fieldName, value) {
        if (!value) {
            this.state.booleanValues[fieldName] = null;
        } else {
            this.state.booleanValues[fieldName] = value === "true";
        }
        this.applyFilters();
    }

    onSelectionChanged(fieldName, value) {
        if (!value) {
            this.state.selectionValues[fieldName] = null;
        } else {
            this.state.selectionValues[fieldName] = value;
        }
        this.applyFilters();
    }

    onMany2oneUpdated(fieldName, val) {
        if (!val || val === false) {
            return;
        }

        const normalizeId = (raw) => {
            if (raw === null || raw === undefined || raw === false) {
                return null;
            }
            if (typeof raw === "number") {
                return Number.isFinite(raw) ? raw : null;
            }
            if (typeof raw === "string") {
                const n = Number.parseInt(raw, 10);
                return Number.isFinite(n) ? n : null;
            }
            if (typeof raw === "object") {
                const id = raw.id ?? raw.resId ?? raw.value ?? raw[0];
                if (typeof id === "number") {
                    return Number.isFinite(id) ? id : null;
                }
                if (typeof id === "string") {
                    const n = Number.parseInt(id, 10);
                    return Number.isFinite(n) ? n : null;
                }
            }
            return null;
        };

        const records = Array.isArray(val) ? val : [val];
        const current = this.state.many2oneValues[fieldName] || [];
        const existingIds = new Set(current.map((r) => r.id));
        const idsNeedingNames = [];

        for (const rec of records) {
            const id = normalizeId(rec);
            if (!id || existingIds.has(id)) {
                continue;
            }
            const displayName = rec?.display_name || rec?.displayName || rec?.name || "";
            const safeDisplayName = displayName || `#${id}`;
            current.push({id, displayName: safeDisplayName});
            existingIds.add(id);
            if (!displayName) {
                idsNeedingNames.push(id);
            }
        }

        this.state.many2oneValues[fieldName] = current;
        this.applyFilters();

        if (idsNeedingNames.length) {
            const col = (this.props.columns || []).find((c) => c.name === fieldName);
            const field = this.getField(col);
            const resModel = field?.relation;
            const ctx = this.props.list?.context;
            if (!resModel) {
                return;
            }
            const uniqueIds = [...new Set(idsNeedingNames)];
            this.orm.webRead(resModel, uniqueIds, {
                specification: {display_name: {}},
                context: ctx,
            }).then((records) => {
                const nameById = new Map(
                    records.map((r) => {
                        const id = normalizeId(r);
                        const name = r?.display_name || r?.displayName || r?.name || "";
                        return [id, name];
                    })
                );
                const updated = (this.state.many2oneValues[fieldName] || []).map((item) => {
                    const name = nameById.get(item.id);
                    return name ? {...item, displayName: name} : item;
                });
                this.state.many2oneValues[fieldName] = updated;
            });
        }
    }

    onMany2manyUpdated(fieldName, val) {
        if (!val || val === false) {
            return;
        }

        const normalizeId = (raw) => {
            if (raw === null || raw === undefined || raw === false) {
                return null;
            }
            if (typeof raw === "number") {
                return Number.isFinite(raw) ? raw : null;
            }
            if (typeof raw === "string") {
                const n = Number.parseInt(raw, 10);
                return Number.isFinite(n) ? n : null;
            }
            if (typeof raw === "object") {
                const id = raw.id ?? raw.resId ?? raw.value ?? raw[0];
                if (typeof id === "number") {
                    return Number.isFinite(id) ? id : null;
                }
                if (typeof id === "string") {
                    const n = Number.parseInt(id, 10);
                    return Number.isFinite(n) ? n : null;
                }
            }
            return null;
        };

        const records = Array.isArray(val) ? val : [val];
        const current = this.state.many2manyValues[fieldName] || [];
        const existingIds = new Set(current.map((r) => r.id));
        const idsNeedingNames = [];

        for (const rec of records) {
            const id = normalizeId(rec);
            if (!id || existingIds.has(id)) {
                continue;
            }
            const displayName = rec?.display_name || rec?.displayName || rec?.name || "";
            const safeDisplayName = displayName || `#${id}`;
            current.push({id, displayName: safeDisplayName});
            existingIds.add(id);
            if (!displayName) {
                idsNeedingNames.push(id);
            }
        }

        this.state.many2manyValues[fieldName] = current;
        this.applyFilters();

        if (idsNeedingNames.length) {
            const col = (this.props.columns || []).find((c) => c.name === fieldName);
            const field = this.getField(col);
            const resModel = field?.relation;
            const ctx = this.props.list?.context;
            if (!resModel) {
                return;
            }
            const uniqueIds = [...new Set(idsNeedingNames)];
            this.orm.webRead(resModel, uniqueIds, {
                specification: {display_name: {}},
                context: ctx,
            }).then((records) => {
                const nameById = new Map(
                    records.map((r) => {
                        const id = normalizeId(r);
                        const name = r?.display_name || r?.displayName || r?.name || "";
                        return [id, name];
                    })
                );
                const updated = (this.state.many2manyValues[fieldName] || []).map((item) => {
                    const name = nameById.get(item.id);
                    return name ? {...item, displayName: name} : item;
                });
                this.state.many2manyValues[fieldName] = updated;
            });
        }
    }

    removeMany2manyTag(fieldName, id) {
        const current = this.state.many2manyValues[fieldName] || [];
        this.state.many2manyValues[fieldName] = current.filter((x) => x.id !== id);
        this.applyFilters();
    }

    clearMany2manyTags(fieldName) {
        this.state.many2manyValues[fieldName] = [];
        this.applyFilters();
    }

    getMany2manyTags(column) {
        const fieldName = column?.name;
        if (!fieldName) {
            return [];
        }
        const selected = this.state.many2manyValues[fieldName] || [];
        return selected.map((r) => ({
            id: `${fieldName}_${r.id}`,
            resId: r.id,
            text: r.displayName || `#${r.id}`,
            onDelete: () => this.removeMany2manyTag(fieldName, r.id),
        }));
    }

    removeMany2oneTag(fieldName, id) {
        const current = this.state.many2oneValues[fieldName] || [];
        this.state.many2oneValues[fieldName] = current.filter((x) => x.id !== id);
        this.applyFilters();
    }

    clearMany2oneTags(fieldName) {
        this.state.many2oneValues[fieldName] = [];
        this.applyFilters();
    }

    getMany2oneTags(column) {
        const fieldName = column?.name;
        if (!fieldName) {
            return [];
        }
        const selected = this.state.many2oneValues[fieldName] || [];
        return selected.map((r) => ({
            id: `${fieldName}_${r.id}`,
            resId: r.id,
            text: r.displayName || `#${r.id}`,
            onDelete: () => this.removeMany2oneTag(fieldName, r.id),
        }));
    }

    async applyFilters() {
        const list = this.props.list;
        if (!list?.load) {
            return;
        }

        if (list.leaveEditMode) {
            await list.leaveEditMode();
        }

        const relationIds = [...(list.resIds || list.currentIds || [])];
        list._mnsAdvanceFullIds = relationIds;
        const fullIds = relationIds;

        const leaves = [];

        for (const column of this.props.columns || []) {
            if (column.type !== "field") {
                continue;
            }
            if (!this.isSupportedFieldType(column)) {
                continue;
            }
            const field = this.getField(column);
            if (field && field.store === false) {
                continue;
            }
            const fieldName = column.name;
            const fieldType = this.getFieldType(column);

            if (fieldType === "char" || fieldType === "text") {
                const term = toLowerSafe(this.state.textValues[fieldName]).trim();
                if (term) {
                    leaves.push([fieldName, "ilike", `%${term}%`]);
                }
            } else if (fieldType === "boolean") {
                const v = this.state.booleanValues[fieldName];
                if (v !== null && v !== undefined) {
                    leaves.push([fieldName, "=", v]);
                }
            } else if (fieldType === "selection") {
                const v = this.state.selectionValues[fieldName];
                if (v !== null && v !== undefined) {
                    leaves.push([fieldName, "=", v]);
                }
            } else if (fieldType === "many2one") {
                const selected = this.state.many2oneValues[fieldName] || [];
                const ids = selected
                    .map((x) => (typeof x.id === "number" ? x.id : Number.parseInt(x.id, 10)))
                    .filter((id) => Number.isFinite(id));
                if (ids.length) {
                    if (ids.length === 1) {
                        leaves.push([fieldName, "=", ids[0]]);
                    } else {
                        leaves.push([fieldName, "in", ids]);
                    }
                }
            } else if (fieldType === "many2many") {
                const selected = this.state.many2manyValues[fieldName] || [];
                const ids = selected
                    .map((x) => (typeof x.id === "number" ? x.id : Number.parseInt(x.id, 10)))
                    .filter((id) => Number.isFinite(id));
                if (ids.length) {
                    leaves.push([fieldName, "in", ids]);
                }
            } else if (fieldType === "integer" || fieldType === "float" || fieldType === "monetary") {
                const fromRaw = (this.state.numberFromValues[fieldName] || "").toString().trim();
                const toRaw = (this.state.numberToValues[fieldName] || "").toString().trim();
                if (fromRaw) {
                    const n = Number.parseFloat(fromRaw);
                    if (Number.isFinite(n)) {
                        leaves.push([fieldName, ">=", n]);
                    }
                }
                if (toRaw) {
                    const n = Number.parseFloat(toRaw);
                    if (Number.isFinite(n)) {
                        leaves.push([fieldName, "<=", n]);
                    }
                }
            } else if (fieldType === "date" || fieldType === "datetime") {
                const fromVal = this.state.dateFromValues[fieldName] || "";
                const toVal = this.state.dateToValues[fieldName] || "";
                if (fromVal) {
                    const fromDomainVal = this.formatDateForAdvanceDomain(fromVal);
                    if (fromDomainVal) {
                        leaves.push([fieldName, ">=", fromDomainVal]);
                    }
                }
                if (toVal) {
                    const toDomainVal = this.formatDateForAdvanceDomain(toVal);
                    if (toDomainVal) {
                        leaves.push([fieldName, "<=", toDomainVal]);
                    }
                }
            }
        }

        if (!leaves.length) {
            list._mnsAdvanceFilteredIds = null;
            await list.load({offset: 0, limit: list.limit});
            return;
        }

        const numericScopeIds = fullIds.filter((id) => typeof id === "number");
        const rel = list.config?.relationField;
        const parent = list._parent;
        let domain;
        if (rel && parent && typeof parent.resId === "number" && parent.resId > 0) {
            domain = [[rel, "=", parent.resId], ...leaves];
        } else if (numericScopeIds.length) {
            domain = [["id", "in", numericScopeIds], ...leaves];
        } else {
            list._mnsAdvanceFilteredIds = [...fullIds];
            await list.load({offset: 0, limit: list.limit});
            return;
        }

        const limit = list.model?.activeIdsLimit ?? Number.MAX_SAFE_INTEGER;
        const ids = await this.orm.search(list.resModel, domain, { limit, context: list.context });

        list._mnsAdvanceFilteredIds = ids;
        await list.load({offset: 0, limit: list.limit});
    }

    getSelectionOptions(column) {
        const field = this.getField(column);
        if (!field || field.type !== "selection") {
            return [];
        }
        const sel = field.selection;
        if (typeof sel === "function") {
            return sel();
        }
        return Array.isArray(sel) ? sel : [];
    }
}
