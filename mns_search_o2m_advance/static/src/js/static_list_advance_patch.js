/** @odoo-module */

import {patch} from "@web/core/utils/patch";
import {StaticList} from "@web/model/relational_model/static_list";

patch(StaticList.prototype, {
    setup(config, data, options = {}) {
        super.setup(...arguments);

        if (this.config?.relationField) {
            this.mnsAdvanceColumnFilters = true;
            if (!this._mnsAdvanceFullIds) {
                this._mnsAdvanceFullIds = [...(this.currentIds || [])];
            }
            this._mnsAdvanceFilteredIds = null;
        }
    },

    load(params = {}) {
        return this.model.mutex.exec(async () => {
            const editedRecord = this.editedRecord;
            if (editedRecord && !(await editedRecord.checkValidity())) {
                return;
            }

            const limit = params.limit !== undefined ? params.limit : this.limit;
            const offset = params.offset !== undefined ? params.offset : this.offset;
            const orderBy = params.orderBy !== undefined ? params.orderBy : this.orderBy;

            let nextCurrentIds =
                this._mnsAdvanceFilteredIds !== null &&
                this._mnsAdvanceFilteredIds !== undefined
                    ? [...this._mnsAdvanceFilteredIds]
                    : [...(this.resIds || this._currentIds || [])];

            if (
                this._mnsSectionNoteRestrictedIds !== null &&
                this._mnsSectionNoteRestrictedIds !== undefined
            ) {
                const allow = new Set(this._mnsSectionNoteRestrictedIds);
                nextCurrentIds = nextCurrentIds.filter((id) => allow.has(id));
            }

            return this._load({
                limit,
                offset,
                orderBy,
                nextCurrentIds,
            });
        });
    },

    async _load(...args) {
        const res = await super._load(...args);

        this.count = this._currentIds.length;

        return res;
    },
});
