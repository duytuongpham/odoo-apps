/** @odoo-module */

import {onMounted, onWillUpdateProps} from "@odoo/owl";
import {patch} from "@web/core/utils/patch";
import {X2ManyField} from "@web/views/fields/x2many/x2many_field";

patch(X2ManyField.prototype, {
    setup() {
        super.setup(...arguments);

        const applyMnsAdvance = () => {
            if (this.props.viewMode !== "list" || this.isMany2Many) {
                return;
            }
            const list = this.list;
            if (!list) {
                return;
            }
            list.mnsAdvanceColumnFilters = true;
            list.mnsAdvanceColumnFiltersFieldName = this.props.name;
            if (!list._mnsAdvanceFullIds) {
                list._mnsAdvanceFullIds = [...(list.currentIds || [])];
            }
            if (list._mnsAdvanceFilteredIds === undefined) {
                list._mnsAdvanceFilteredIds = null;
            }
        };

        applyMnsAdvance();
        onMounted(applyMnsAdvance);
        onWillUpdateProps(() => applyMnsAdvance());
    },
});
