/** @odoo-module */

import {Domain} from "@web/core/domain";
import {patch} from "@web/core/utils/patch";
import {useDebounced} from "@web/core/utils/timing";
import {
    parseFloat as parseFloatField,
    parseInteger,
    parseMonetary,
} from "@web/views/fields/parsers";
import {_t} from "@web/core/l10n/translation";
import {ListRenderer} from "@web/views/list/list_renderer";
import {Many2XAutocomplete} from "@web/views/fields/relational_utils";
import {useService} from "@web/core/utils/hooks";
import {useState} from "@odoo/owl";

const SKIP_TYPES = new Set([
    "binary",
    "image",
    "html",
    "many2many",
    "one2many",
    "json",
    "reference",
]);

const MNS_M2O_FILTER_ACTIVE_ACTIONS = {
    create: false,
    createEdit: false,
    write: false,
};

ListRenderer.components = {
    ...ListRenderer.components,
    Many2XAutocomplete,
};

patch(ListRenderer.prototype, {
    setup() {
        super.setup(...arguments);
        this.mnsFilterValues = useState({});
        this.mnsLastAppliedFieldNames = new Set();
        this.mnsStaticFilteredResIds = null;
        this.orm = useService("orm");
        this.mnsDebouncedApply = useDebounced(this.mnsApplyColumnFilters.bind(this), 400);
    },

    get mnsShowAdvancedFilters() {
        return Boolean(this.props.nestedKeyOptionalFieldsData) && !this.props.list.isGrouped;
    },

    mnsIsStaticO2MList() {
        return this.props.list?.constructor?.type === "StaticList";
    },

    get mnsFilteredRecords() {
        const recs = this.props.list.records;
        const ids = this.mnsStaticFilteredResIds;
        if (!this.mnsIsStaticO2MList() || !ids || !ids.length) {
            return recs;
        }
        const allowed = new Set(ids);
        return recs.filter((r) => allowed.has(r.resId));
    },

    mnsIsFilterableField(field) {
        if (!field || SKIP_TYPES.has(field.type)) {
            return false;
        }
        return true;
    },

    mnsFilterableColumnNames() {
        const names = [];
        for (const column of this.columns) {
            if (column.type !== "field" || column.widget === "handle") {
                continue;
            }
            const field = this.fields[column.name];
            if (this.mnsIsFilterableField(field)) {
                names.push(column.name);
            }
        }
        return names;
    },

    mnsGetActiveFilterFieldNames() {
        const active = [];
        for (const column of this.columns) {
            if (column.type !== "field" || column.widget === "handle") {
                continue;
            }
            const field = this.fields[column.name];
            if (!this.mnsIsFilterableField(field)) {
                continue;
            }
            const name = column.name;
            if (field.type === "many2one") {
                const st = this.mnsFilterValues[name];
                if (st && typeof st === "object" && Number.isInteger(st.id)) {
                    active.push(name);
                }
                continue;
            }
            if (field.type === "date" || field.type === "datetime") {
                if (this.mnsGetDatePart(name, "from") || this.mnsGetDatePart(name, "to")) {
                    active.push(name);
                }
                continue;
            }
            const v = this.mnsFilterValues[name];
            if (v !== undefined && v !== null && typeof v !== "object" && String(v).trim() !== "") {
                active.push(name);
            }
        }
        return active;
    },

    mnsOnCharFilter(columnName, ev) {
        this.mnsFilterValues[columnName] = ev.target.value;
        this.mnsDebouncedApply();
    },

    mnsOnDatePart(columnName, part, ev) {
        const key = `${columnName}__${part}`;
        this.mnsFilterValues[key] = ev.target.value;
        this.mnsDebouncedApply();
    },

    mnsOnSelectionFilter(columnName, ev) {
        this.mnsFilterValues[columnName] = ev.target.value;
        this.mnsDebouncedApply();
    },

    mnsOnNumberFilter(columnName, ev) {
        this.mnsFilterValues[columnName] = ev.target.value;
        this.mnsDebouncedApply();
    },

    mnsMany2XProps(column) {
        const field = this.fields[column.name];
        const name = column.name;
        const stored = this.mnsFilterValues[name];
        const displayName =
            stored && typeof stored === "object" && stored.displayName != null
                ? stored.displayName
                : "";
        const listId = `${this.props.list.resModel}_${this.props.list.id}_${name}`;
        return {
            id: `mns_o2m_adv_m2o_${listId}`,
            value: displayName,
            placeholder: field.string || "",
            resModel: field.relation,
            fieldString: field.string || name,
            activeActions: MNS_M2O_FILTER_ACTIVE_ACTIONS,
            getDomain: () => [],
            context: {...(this.props.list.context || {})},
            nameCreateField: "name",
            searchLimit: 10,
            searchMoreLimit: 80,
            noSearchMore: false,
            quickCreate: null,
            autoSelect: false,
            setInputFloats: () => {},
            update: (val) => this.mnsOnMany2oneFilterUpdate(name, val),
        };
    },

    async mnsOnMany2oneFilterUpdate(fieldName, value) {
        if (!this.mnsShowAdvancedFilters) {
            return;
        }
        if (!value || (Array.isArray(value) && value.length === 0)) {
            delete this.mnsFilterValues[fieldName];
        } else {
            const row = Array.isArray(value) ? value[0] : value;
            this.mnsFilterValues[fieldName] = {
                id: row.id,
                displayName: row.display_name || row.name || "",
            };
        }
        await this.mnsApplyColumnFilters();
    },

    mnsDateKey(columnName, part) {
        return `${columnName}__${part}`;
    },

    mnsGetDatePart(columnName, part) {
        return this.mnsFilterValues[this.mnsDateKey(columnName, part)] || "";
    },

    mnsLabelFrom() {
        return _t("From");
    },

    mnsLabelTo() {
        return _t("To");
    },

    mnsClearFiltersTitle() {
        return _t("Clear column filters");
    },

    mnsClearFiltersLink() {
        return _t("Clear");
    },

    mnsYesLabel() {
        return _t("Yes");
    },

    mnsNoLabel() {
        return _t("No");
    },

    mnsBuildFilterDomain() {
        const leaves = [];
        for (const column of this.columns) {
            if (column.type !== "field" || column.widget === "handle") {
                continue;
            }
            const field = this.fields[column.name];
            if (!this.mnsIsFilterableField(field)) {
                continue;
            }
            const name = column.name;
            const type = field.type;

            if (type === "char" || type === "text") {
                const v = (this.mnsFilterValues[name] || "").trim();
                if (v) {
                    leaves.push([name, "ilike", v]);
                }
                continue;
            }

            if (type === "boolean") {
                const v = this.mnsFilterValues[name];
                if (v === "true") {
                    leaves.push([name, "=", true]);
                } else if (v === "false") {
                    leaves.push([name, "=", false]);
                }
                continue;
            }

            if (type === "selection") {
                const v = this.mnsFilterValues[name];
                if (v !== undefined && v !== null && v !== "") {
                    leaves.push([name, "=", v]);
                }
                continue;
            }

            if (type === "date" || type === "datetime") {
                const dFrom = this.mnsGetDatePart(name, "from");
                const dTo = this.mnsGetDatePart(name, "to");
                if (dFrom) {
                    leaves.push([name, ">=", dFrom]);
                }
                if (dTo) {
                    leaves.push([name, "<=", dTo]);
                }
                continue;
            }

            if (type === "integer") {
                const raw = (this.mnsFilterValues[name] || "").trim();
                if (!raw) {
                    continue;
                }
                try {
                    leaves.push([name, "=", parseInteger(raw)]);
                } catch {
                }
                continue;
            }

            if (type === "float" || type === "float_time") {
                const raw = (this.mnsFilterValues[name] || "").trim();
                if (!raw) {
                    continue;
                }
                try {
                    const n = parseFloatField(raw);
                    if (!Number.isNaN(n)) {
                        leaves.push([name, "=", n]);
                    }
                } catch {
                }
                continue;
            }

            if (type === "monetary") {
                const raw = (this.mnsFilterValues[name] || "").trim();
                if (!raw) {
                    continue;
                }
                try {
                    leaves.push([name, "=", parseMonetary(raw)]);
                } catch {
                }
                continue;
            }

            if (type === "many2one") {
                const st = this.mnsFilterValues[name];
                if (st && typeof st === "object" && Number.isInteger(st.id)) {
                    leaves.push([name, "=", st.id]);
                }
            }
        }
        if (!leaves.length) {
            return new Domain([]);
        }
        return Domain.and(leaves.map((leaf) => new Domain([leaf])));
    },

    async mnsApplyColumnFilters() {
        if (!this.mnsShowAdvancedFilters) {
            return;
        }
        const list = this.props.list;
        const leaved = await list.leaveEditMode();
        if (!leaved) {
            return;
        }
        const activeNames = this.mnsGetActiveFilterFieldNames();

        if (this.mnsIsStaticO2MList()) {
            if (!activeNames.length) {
                this.mnsStaticFilteredResIds = null;
                this.mnsLastAppliedFieldNames = new Set();
                this.render();
                return;
            }
            const numericIds = list.currentIds.filter((i) => typeof i === "number");
            if (!numericIds.length) {
                this.mnsStaticFilteredResIds = [];
                this.mnsLastAppliedFieldNames = new Set(activeNames);
                this.render();
                return;
            }
            const extra = this.mnsBuildFilterDomain();
            const idDomain = new Domain([["id", "in", numericIds]]);
            const combined = Domain.and([idDomain, extra]).toList({});
            const filteredIds = await this.orm.search(list.resModel, combined, {
                context: list.context || {},
            });
            this.mnsStaticFilteredResIds = filteredIds;
            this.mnsLastAppliedFieldNames = new Set(activeNames);
            this.render();
            return;
        }

        const keysToRemove = [
            ...new Set([...this.mnsLastAppliedFieldNames, ...activeNames]),
        ];
        let base = Domain.removeDomainLeaves(new Domain(list.domain), keysToRemove);
        const extra = this.mnsBuildFilterDomain();
        const combined = Domain.and([base, extra]).toList({});
        this.mnsLastAppliedFieldNames = new Set(activeNames);
        await list.load({domain: combined, offset: 0});
        this.render();
    },

    async mnsClearColumnFilters() {
        if (!this.mnsShowAdvancedFilters) {
            return;
        }
        const list = this.props.list;
        const leaved = await list.leaveEditMode();
        if (!leaved) {
            return;
        }
        const keys = this.mnsFilterableColumnNames();
        const hadActive = this.mnsGetActiveFilterFieldNames();
        for (const name of keys) {
            delete this.mnsFilterValues[name];
            const f = this.fields[name];
            if (f && (f.type === "date" || f.type === "datetime")) {
                delete this.mnsFilterValues[`${name}__from`];
                delete this.mnsFilterValues[`${name}__to`];
            }
        }
        const toStrip = [...new Set([...this.mnsLastAppliedFieldNames, ...hadActive])];
        this.mnsLastAppliedFieldNames = new Set();
        if (this.mnsIsStaticO2MList()) {
            this.mnsStaticFilteredResIds = null;
            this.render();
            return;
        }
        const base = Domain.removeDomainLeaves(new Domain(list.domain), toStrip);
        await list.load({domain: base.toList({}), offset: 0});
        this.render();
    },
});
