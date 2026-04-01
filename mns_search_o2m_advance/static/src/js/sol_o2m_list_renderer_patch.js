/** @odoo-module */

import {patch} from "@web/core/utils/patch";
import {SaleOrderLineListRenderer} from "@sale/js/sale_order_line_field/sale_order_line_field";

if (SaleOrderLineListRenderer) {
    SaleOrderLineListRenderer.template = "web.ListRenderer";
}

