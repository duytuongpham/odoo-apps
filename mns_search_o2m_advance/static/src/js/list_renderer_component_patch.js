/** @odoo-module */

import {patch} from "@web/core/utils/patch";
import {ListRenderer} from "@web/views/list/list_renderer";
import {MnsO2mAdvanceHeaderFilters} from "./mns_list_header_filters";
import {MnsSectionNoteSectionSearch} from "./mns_section_note_section_search";

ListRenderer.components = {
    ...ListRenderer.components,
    MnsO2mAdvanceHeaderFilters,
    MnsSectionNoteSectionSearch,
};

patch(ListRenderer.prototype, {
    mnsShouldShowO2mHeaderFilters() {
        const list = this.props.list;
        if (!list || list.isGrouped) {
            return false;
        }
        if (this.props.nestedKeyOptionalFieldsData) {
            return true;
        }
        if (list.mnsAdvanceColumnFilters) {
            return true;
        }
        const t = list.constructor?.type;
        const n = list.constructor?.name;
        if (t === "StaticList" || n === "StaticList") {
            return true;
        }
        return false;
    },

    mnsShouldShowSectionNoteSectionFilter() {
        if (!this.mnsShouldShowO2mHeaderFilters()) {
            return false;
        }
        const fields = this.props.list?.fields;
        if (!fields?.display_type) {
            return false;
        }
        let C = this.constructor;
        while (C) {
            if (C.name === "SectionAndNoteListRenderer") {
                return true;
            }
            C = Object.getPrototypeOf(C);
        }
        return false;
    },
});
