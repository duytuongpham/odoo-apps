/** @odoo-module */

import {ListRenderer} from "@web/views/list/list_renderer";
import {SectionAndNoteListRenderer} from "@account/components/section_and_note_fields_backend/section_and_note_fields_backend";
import {ProductLabelSectionAndNoteListRender} from "@account/components/product_label_section_and_note_field/product_label_section_and_note_field";
import {SaleOrderLineListRenderer} from "@sale/js/sale_order_line_field/sale_order_line_field";

const baseComponents = {...ListRenderer.components};

function mergeListRendererComponents(Ctor) {
    if (!Ctor) {
        return;
    }
    Ctor.components = {...baseComponents, ...(Ctor.components || {})};
}

mergeListRendererComponents(SectionAndNoteListRenderer);
mergeListRendererComponents(ProductLabelSectionAndNoteListRender);
mergeListRendererComponents(SaleOrderLineListRenderer);
