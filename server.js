import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import { pathToFileURL, fileURLToPath } from 'url';
import { readFile, writeFile, mkdir, readdir, stat, unlink } from 'fs/promises';
import * as XLSX from 'xlsx';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query as pgQuery, withTransaction } from './db/postgres.js';

// STUBS para servicios faltantes en el entorno actual
const ensureInventorySchema = async () => console.warn('Inventory Service: Schema stub');
const listInventory = async () => [];
const getTroquelByCode = async () => null;
const saveInventory = async () => ({ ok: true });
const importInventory = async () => ({ ok: true });
const exportInventoryWorkbook = async () => ({});
const calculateProcessQuote = async () => ({ ok: true, data: {} });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const APP_ROOT = __dirname;
const DATA_ROOT = path.resolve(__dirname, '..');
const CONFIG_DIR = path.join(APP_ROOT, 'config');
const GENERAL_CONFIG_PATH = path.join(CONFIG_DIR, 'general-config.json');
const PUBLIC_UPLOADS_DIR = path.join(APP_ROOT, 'public', 'uploads');
const LOGIN_REPOSITORY_DIR = path.join(PUBLIC_UPLOADS_DIR, 'login-repository');
const LOGIN_REPOSITORY_URL_BASE = '/uploads/login-repository';
const ERP_IMPRESION_DIR = path.join(APP_ROOT, 'integrations', 'erp-impresion');
const ERP_IMPRESION_PUBLIC_DIR = path.join(ERP_IMPRESION_DIR, 'public');
const ERP_IMPRESION_HELPERS_PATH = path.join(ERP_IMPRESION_DIR, 'dist', 'web', 'server-helpers.js');
const FT2_PER_M2 = 10.7639104167;

const PRESENTATION_NAMES = {
    'dashboard': 'Dashboard',
    'configuracion-general': 'Configuración General',
    'cotizaciones': 'Cotizaciones',
    'solicitudes': 'Solicitudes',
    'calculos': 'Cálculos',
    'socios': 'Socios',
    'inventario-mp': 'Inventario Materia Prima',
    'inventario-troqueles': 'Inventario Troqueles',
    'socios': 'Socios',
    'inventario-mp': 'Inventario Materia Prima',
    'inventario-troqueles': 'Inventario Troqueles',
    'inventario-maquinaria': 'Inventario Maquinaria',
    'costos': 'Costos',
    'vendedores': 'Vendedores',
    'ordenes': 'Ordenes',
    'planificacion': 'Planificación',
    'seguimiento': 'Seguimiento'
};

function createDefaultPresentation(name) {
    return {
        moduleTitle: name,
        brandWidth: 116,
        brandFontFamily: 'Georgia, Times New Roman, serif',
        brandFontSize: 22,
        brandColor: '#ffffff',
        brandVerticalAlign: 'center',
        brandHorizontalAlign: 'center',
        brandMarginTop: 0,
        brandMarginRight: 0,
        brandMarginBottom: 0,
        brandMarginLeft: 0,
        titleFontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        titleFontSize: 16,
        titleVerticalAlign: 'center',
        titleHorizontalAlign: 'left',
        titleMarginLeft: 30,
        titleWidth: 0,
        titleColor: '#252c33',
        logoPosition: 'left',
        brandLogoUrl: '',
        headerBgStart: '',
        headerBgEnd: '',
        headerBorderColor: '',
        footerBorderColor: '',
        footerFontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        footerFontSize: 12,
        footerColor: '#2f3740',
        footerMarginTop: 0,
        footerMarginBottom: 0,
        fieldFontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        fieldHeight: 18,
        fieldFontSize: 12,
        labelAlign: '',
        mediumInputWidth: 0,
        largeInputWidth: 0,
        tableHeaderFontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        tableHeaderFontSize: 11,
        tabColor: '#7f7f7f',
        tabHeight: 18,
        tabWidth: 88,
        tableRowHeight: 22,
        iconSize: 20,
        pageMarginTop: 14,
        pageMarginBottom: 8,
        pageMarginRight: 16,
        pageMarginLeft: 16
    };
}

const DEFAULT_PRESENTATIONS = {};
Object.keys(PRESENTATION_NAMES).forEach(key => {
    DEFAULT_PRESENTATIONS[key] = createDefaultPresentation(PRESENTATION_NAMES[key]);
});

const EMPTY_PRESENTATIONS = {};
Object.keys(PRESENTATION_NAMES).forEach(key => {
    EMPTY_PRESENTATIONS[key] = {};
});

const DEFAULT_GENERAL_CONFIG = {
    branding: {
        companyName: 'PrintLab',
        logoUrl: '',
        companyLogoUrl: '',
        loginBackgroundUrl: ''
    },
    contact: {
        companyPhone: '+506 0000 0000',
        companyEmail: 'info@printlab.local'
    },
    appearance: {
        fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
    },
    session: {
        currentUser: 'admin'
    },
    icons: {
        topBack: '\u2190',
        topMenu: '\u2261',
        topSearch: '\u2315',
        topUser: '\u25D4',
        dashboardBusinessPartners: '\u25A6',
        dashboardQuotes: '\u25A4',
        dashboardInventory: '\u25A5',
        dashboardOrders: '\u2699',
        dashboardCosts: '\u25A7',
        dashboardSettings: '\u2692',
        mobileQuotes: '\u25A4',
        mobileOrders: '\u2699',
        mobilePartners: '\u25A6',
        mobileAlerts: '\u25CE',
        mobileTheme: '\u263C',
        mobileRefresh: '\u21BB',
        mobileMenu: '\u22EF',
        dashboardTabClose: '\u2715',
        quotePrev: '\u2039',
        quoteLookup: '\u2315',
        quoteNext: '\u203A',
        quoteNumberBoldOn: 'B',
        quoteNumberBoldOff: 'b',
        popoverClose: '\u2715',
        tableMove: '\u22EE\u22EE',
        tableOpen: '\u2699',
        tableAdd: '+',
        quantityAdd: '+',
        fieldInfo: 'i',
        processLauncher: '\u25CE',
        favoriteDocumentOff: '\u2606',
        favoriteDocumentOn: '\u2605',
        refreshCosts: '\u21BB',
        timelineLauncher: '\u25F4',
        floatingSave: '💾',
        tableActions: '\u22EF',
        lineDuplicate: '\u2398',
        lineCopy: '\u2398',
        lineCreateQuote: '\u25A3',
        lineExport: '\u2B73',
        lineAttachments: '📎',
        lineCreateOrder: '\u2692',
        lineDelete: '\u2715',
        copyQuoteSend: '\u27A4',
        attachmentUpload: '\u21E7',
        attachmentDownload: '\u21E9',
        attachmentReplace: '\u21BB',
        adminUserCreate: '+',
        adminUserDelete: '\u{1F5D1}',
        adminPermissionCreate: '+',
        adminPermissionDelete: '\u{1F5D1}',
        loginRepositoryUpload: '\u21E7',
        loginRepositoryDelete: '\u{1F5D1}',
        dashboardPlanning: '\u25F3',
        browserOpen: '\u2197',
        lineCreateProductionOrder: '\u21E2',
        quoteRequestSubmit: '\u27A4',
        quoteRequestAdvanced: '\u2699',
        quoteRequestAttachment: '\uD83D\uDCCE',
        quoteRequestRecord: '\uD83C\uDFA4',
        quoteRequestRecordStop: '\u25A0',
        proformaCurrencyAdd: '+',
        proformaCurrencyDelete: '\u{1F5D1}',
        proformaView: '\u{1F441}',
        proformaClose: '\u2713'
    },
    layout: {
        logoWidth: 60,
        companyLogoWidth: 60,
        headerLabelWidth: 58,
        quoteNumberFontSize: 16,
        tableRowHeight: 22,
        tableHeaderFontSize: 11,
        tableFontSize: 12,
        tabWidth: 88,
        tabHeight: 18,
        tabColor: '#7f7f7f',
        iconSize: 20,
        pageMarginTop: 14,
        pageMarginRight: 16,
        pageMarginBottom: 8,
        pageMarginLeft: 16,
        headerBgStart: '#0b81b8',
        headerBgEnd: '#17abdf'
    },
    general: {
        companyName: 'PrintLab',
        companyPhone: '+506 0000 0000',
        companyEmail: 'info@printlab.local',
        loginScreensaverMotionSeconds: 16,
        loginScreensaverSlideSeconds: 10,
        mobileSellerAutoRoute: 'true',
        mobileSellerTheme: 'light',
        mobileSellerLightBg: '#f5f7fb',
        mobileSellerDarkBg: '#0f172a',
        defaultRollWidth: 13,
        defaultCoreDiameter: 3,
        defaultQuantityTypes: 1,
        defaultCmykEnabled: 'true',
        proformaLogoUrl: '',
        proformaCompanyName: 'PrintLab',
        proformaSlogan: '',
        proformaHeaderColor: '#203852',
        proformaCompanyNameColor: '#ffffff',
        proformaCompanyFontFamily: 'Cormorant Garamond',
        proformaCompanyFontLabel: 'Fuente Proforma',
        proformaCompanyFontUrl: '',
        proformaShowCompanyName: 'true',
        proformaLogoWidth: 120,
        proformaLogoHeight: 74,
        proformaLogoAspectLocked: 'true',
        proformaLogoMarginTop: 0,
        proformaLogoMarginLeft: 0,
        proformaPhone: '+506 0000 0000',
        proformaWebsite: 'www.printlab.local',
        proformaEmail: 'info@printlab.local',
        proformaDefaultCurrency: 'CRC',
        proformaCurrenciesJson: JSON.stringify([
            { code: 'CRC', label: 'Colones', symbol: '₡', exchangeRate: 1 },
            { code: 'USD', label: 'Dólares', symbol: '$', exchangeRate: 0.0019 }
        ]),
        proformaDefaultValidity: '15 días',
        proformaIntro: '',
        proformaIntroFontFamily: 'inherit',
        proformaIntroFontSize: 15,
        proformaIntroColor: '#2f3c46',
        proformaTermsConditions: '',
        proformaPaymentTerms: '',
        proformaDeliveryTime: '',
        proformaTechnicalSpecs: '',
        proformaQualityPolicies: '',
        proformaPriceDisplayMode: 'both',
        proformaSellerSignatureEnabled: 'true',
        dieShapeLabel1: 'Circular',
        dieShapeLabel2: 'Cuadrado',
        dieShapeLabel3: 'Rectangular',
        dieShapeLabel4: 'Ovalado',
        dieShapeLabel5: 'Especial',
        dieShapeImage1: '',
        dieShapeImage2: '',
        dieShapeImage3: '',
        dieShapeImage4: '',
        dieShapeImage5: '',
        partnerCodePrefix: 'CL',
        brandFontFamily: 'Georgia, Times New Roman, serif',
        brandFontSize: 22,
        brandWidth: 116,
        brandColor: '#0b81b8',
        brandVerticalAlign: 'center',
        brandHorizontalAlign: 'left',
        brandLogoPosition: 'left',
        logoWidth: 116,
        moduleTitle: 'PrintLab',
        titleFontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        titleFontSize: 16,
        titleWidth: 0,
        titleColor: '#252c33',
        titleVerticalAlign: 'center',
        titleHorizontalAlign: 'left',
        quoteNumberFontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        quoteNumberFontSize: 16,
        quoteNumberWidth: 0,
        quoteNumberAutoWidth: 'true',
        quoteNumberBold: 'false',
        quoteNumberVerticalAlign: 'center',
        quoteNumberHorizontalAlign: 'right',
        quoteNumberPaddingTop: 0,
        quoteNumberPaddingRight: 14,
        quoteNumberPaddingBottom: 0,
        quoteNumberPaddingLeft: 14,
        headerBgStart: '#0b81b8',
        headerBgEnd: '#17abdf',
        footerBorderColor: '#11a3dd',
        footerFontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        footerFontSize: 12,
        footerColor: '#2f3740',
        footerMarginTop: 0,
        footerMarginBottom: 0,
        fieldFontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        fieldHeight: 18,
        fieldFontSize: 12,
        tableHeaderFontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        tableHeaderFontSize: 11,
        tabHeight: 18,
        tabWidth: 88,
        tabColor: '#7f7f7f',
        tableRowHeight: 22,
        iconSize: 20,
        iconColor: '#9ba2ab',
        iconColorTopBack: '#9ba2ab',
        iconColor2TopBack: '#ffffff',
        iconColorHoverTopBack: '#0b81b8',
        iconColorTopMenu: '#9ba2ab',
        iconColor2TopMenu: '#ffffff',
        iconColorHoverTopMenu: '#0b81b8',
        iconColorTopSearch: '#9ba2ab',
        iconColor2TopSearch: '#ffffff',
        iconColorHoverTopSearch: '#0b81b8',
        iconColorTopUser: '#9ba2ab',
        iconColor2TopUser: '#ffffff',
        iconColorHoverTopUser: '#0b81b8',
        iconColorDashboardBusinessPartners: '#0b81b8',
        iconColor2DashboardBusinessPartners: '#ffffff',
        iconColorHoverDashboardBusinessPartners: '#17abdf',
        iconColorDashboardQuotes: '#0b81b8',
        iconColor2DashboardQuotes: '#ffffff',
        iconColorHoverDashboardQuotes: '#17abdf',
        iconColorDashboardInventory: '#0b81b8',
        iconColor2DashboardInventory: '#ffffff',
        iconColorHoverDashboardInventory: '#17abdf',
        iconColorDashboardOrders: '#0b81b8',
        iconColor2DashboardOrders: '#ffffff',
        iconColorHoverDashboardOrders: '#17abdf',
        iconColorDashboardCosts: '#0b81b8',
        iconColor2DashboardCosts: '#ffffff',
        iconColorHoverDashboardCosts: '#17abdf',
        iconColorDashboardSettings: '#0b81b8',
        iconColor2DashboardSettings: '#ffffff',
        iconColorHoverDashboardSettings: '#17abdf',
        iconColorDashboardTabClose: '#8c97a2',
        iconColor2DashboardTabClose: '#ffffff',
        iconColorHoverDashboardTabClose: '#0b81b8',
        iconColorQuotePrev: '#9ba2ab',
        iconColor2QuotePrev: '#ffffff',
        iconColorHoverQuotePrev: '#0b81b8',
        iconColorQuoteLookup: '#9ba2ab',
        iconColor2QuoteLookup: '#ffffff',
        iconColorHoverQuoteLookup: '#0b81b8',
        iconColorQuoteNext: '#9ba2ab',
        iconColor2QuoteNext: '#ffffff',
        iconColorHoverQuoteNext: '#0b81b8',
        iconColorQuoteNumberBoldOn: '#0b81b8',
        iconColor2QuoteNumberBoldOn: '#ffffff',
        iconColorHoverQuoteNumberBoldOn: '#07638c',
        iconColorQuoteNumberBoldOff: '#8c97a2',
        iconColor2QuoteNumberBoldOff: '#ffffff',
        iconColorHoverQuoteNumberBoldOff: '#0b81b8',
        iconColorPopoverClose: '#6b7580',
        iconColor2PopoverClose: '#ffffff',
        iconColorHoverPopoverClose: '#0b81b8',
        iconColorTableMove: '#9ba2ab',
        iconColor2TableMove: '#ffffff',
        iconColorHoverTableMove: '#0b81b8',
        iconColorTableOpen: '#9ba2ab',
        iconColor2TableOpen: '#ffffff',
        iconColorHoverTableOpen: '#0b81b8',
        iconColorTableAdd: '#9ba2ab',
        iconColor2TableAdd: '#ffffff',
        iconColorHoverTableAdd: '#0b81b8',
        iconColorQuantityAdd: '#738196',
        iconColor2QuantityAdd: '#ffffff',
        iconColorHoverQuantityAdd: '#0b81b8',
        iconColorFieldInfo: '#4f6f8f',
        iconColor2FieldInfo: '#ffffff',
        iconColorHoverFieldInfo: '#0b81b8',
        iconColorProcessLauncher: '#0b81b8',
        iconColor2ProcessLauncher: '#ffffff',
        iconColorHoverProcessLauncher: '#07638c',
        iconColorFavoriteDocumentOff: '#a2aab5',
        iconColor2FavoriteDocumentOff: '#ffffff',
        iconColorHoverFavoriteDocumentOff: '#c79b18',
        iconColorFavoriteDocumentOn: '#c79b18',
        iconColor2FavoriteDocumentOn: '#ffffff',
        iconColorHoverFavoriteDocumentOn: '#9f7b12',
        iconColorRefreshCosts: '#5b7896',
        iconColor2RefreshCosts: '#ffffff',
        iconColorHoverRefreshCosts: '#0b81b8',
        iconColorTimelineLauncher: '#5f7392',
        iconColor2TimelineLauncher: '#ffffff',
        iconColorHoverTimelineLauncher: '#0b81b8',
        iconColorFloatingSave: '#ffffff',
        iconColor2FloatingSave: '#ffffff',
        iconColorHoverFloatingSave: '#ffffff',
        iconColorTableActions: '#9ba2ab',
        iconColor2TableActions: '#ffffff',
        iconColorHoverTableActions: '#0b81b8',
        iconColorLineDuplicate: '#46515d',
        iconColor2LineDuplicate: '#ffffff',
        iconColorHoverLineDuplicate: '#0b81b8',
        iconColorLineCopy: '#46515d',
        iconColor2LineCopy: '#ffffff',
        iconColorHoverLineCopy: '#0b81b8',
        iconColorLineCreateQuote: '#46515d',
        iconColor2LineCreateQuote: '#ffffff',
        iconColorHoverLineCreateQuote: '#0b81b8',
        iconColorLineExport: '#46515d',
        iconColor2LineExport: '#ffffff',
        iconColorHoverLineExport: '#0b81b8',
        iconColorLineAttachments: '#46515d',
        iconColor2LineAttachments: '#ffffff',
        iconColorHoverLineAttachments: '#0b81b8',
        iconColorLineCreateOrder: '#46515d',
        iconColor2LineCreateOrder: '#ffffff',
        iconColorHoverLineCreateOrder: '#0b81b8',
        iconColorLineDelete: '#a74343',
        iconColor2LineDelete: '#ffffff',
        iconColorHoverLineDelete: '#d03535',
        iconColorCopyQuoteSend: '#0b81b8',
        iconColor2CopyQuoteSend: '#ffffff',
        iconColorHoverCopyQuoteSend: '#07638c',
        iconColorAttachmentUpload: '#0b81b8',
        iconColor2AttachmentUpload: '#ffffff',
        iconColorHoverAttachmentUpload: '#07638c',
        iconColorAttachmentDownload: '#0b81b8',
        iconColor2AttachmentDownload: '#ffffff',
        iconColorHoverAttachmentDownload: '#07638c',
        iconColorAttachmentReplace: '#0b81b8',
        iconColor2AttachmentReplace: '#ffffff',
        iconColorHoverAttachmentReplace: '#07638c',
        iconColorDashboardPlanning: '#0b81b8',
        iconColor2DashboardPlanning: '#ffffff',
        iconColorHoverDashboardPlanning: '#17abdf',
        iconColorBrowserOpen: '#0b81b8',
        iconColor2BrowserOpen: '#ffffff',
        iconColorHoverBrowserOpen: '#07638c',
        iconColorLineCreateProductionOrder: '#0b81b8',
        iconColor2LineCreateProductionOrder: '#ffffff',
        iconColorHoverLineCreateProductionOrder: '#07638c',
        iconColorQuoteRequestSubmit: '#ffffff',
        iconColor2QuoteRequestSubmit: '#ffffff',
        iconColorHoverQuoteRequestSubmit: '#ffffff',
        iconColorQuoteRequestAdvanced: '#5f7288',
        iconColor2QuoteRequestAdvanced: '#ffffff',
        iconColorHoverQuoteRequestAdvanced: '#4a5a6d',
        iconColorQuoteRequestAttachment: '#1e516d',
        iconColor2QuoteRequestAttachment: '#ffffff',
        iconColorHoverQuoteRequestAttachment: '#153a4d',
        iconColorQuoteRequestRecord: '#1e516d',
        iconColor2QuoteRequestRecord: '#ffffff',
        iconColorHoverQuoteRequestRecord: '#153a4d',
        iconColorQuoteRequestRecordStop: '#1e516d',
        iconColor2QuoteRequestRecordStop: '#ffffff',
        iconColorHoverQuoteRequestRecordStop: '#153a4d',
        iconBgTopMenu: '',
        iconBgTopSearch: '',
        iconBgTopUser: '',
        iconBgTopBack: '',
        iconBgQuotePrev: '',
        iconBgQuoteLookup: '',
        iconBgQuoteNext: '',
        iconBgPopoverClose: '',
        iconBgTableMove: '',
        iconBgTableOpen: '',
        iconBgTableAdd: '',
        iconSizeTopBack: 20,
        iconSizeTopMenu: 20,
        iconSizeTopSearch: 20,
        iconSizeTopUser: 20,
        iconSizeDashboardBusinessPartners: 38,
        iconSizeDashboardQuotes: 38,
        iconSizeDashboardInventory: 38,
        iconSizeDashboardOrders: 38,
        iconSizeDashboardCosts: 38,
        iconSizeDashboardSettings: 38,
        iconSizeDashboardTabClose: 14,
        iconSizeQuotePrev: 18,
        iconSizeQuoteLookup: 18,
        iconSizeQuoteNext: 18,
        iconSizeQuoteNumberBoldOn: 16,
        iconSizeQuoteNumberBoldOff: 16,
        iconSizePopoverClose: 18,
        iconSizeTableMove: 20,
        iconSizeTableOpen: 20,
        iconSizeTableAdd: 20,
        iconSizeQuantityAdd: 20,
        iconSizeFieldInfo: 12,
        iconSizeProcessLauncher: 24,
        iconSizeFavoriteDocumentOff: 20,
        iconSizeFavoriteDocumentOn: 20,
        iconSizeRefreshCosts: 20,
        iconSizeTimelineLauncher: 20,
        iconSizeFloatingSave: 20,
        iconSizeTableActions: 20,
        iconSizeLineDuplicate: 18,
        iconSizeLineCopy: 18,
        iconSizeLineCreateQuote: 18,
        iconSizeLineExport: 18,
        iconSizeLineAttachments: 18,
        iconSizeLineCreateOrder: 18,
        iconSizeLineDelete: 18,
        iconSizeCopyQuoteSend: 16,
        iconSizeAttachmentUpload: 18,
        iconSizeAttachmentDownload: 18,
        iconSizeAttachmentReplace: 18,
        iconSizeDashboardPlanning: 38,
        iconSizeBrowserOpen: 18,
        iconSizeLineCreateProductionOrder: 18,
        iconSizeQuoteRequestSubmit: 18,
        iconSizeQuoteRequestAdvanced: 18,
        iconSizeQuoteRequestAttachment: 18,
        iconSizeQuoteRequestRecord: 18,
        iconSizeQuoteRequestRecordStop: 18,
        pageMarginTop: 14,
        pageMarginBottom: 8,
        pageMarginRight: 16,
        pageMarginLeft: 16
    },
    presentations: EMPTY_PRESENTATIONS
};

const DEFAULT_COSTS_CONFIG = {
    general: {
        notes: '',
        updatedAt: null,
        defaultRollWidth: 13,
        defaultCoreDiameter: 3,
        coreDiameterOptions: ['1', '1.5', '3', '6'],
        defaultQuantityTypes: 1,
        defaultCmykEnabled: 'true'
    },
    convencional: {
        tintaGeneral: {
            bcmGenerico: 2,
            coberturaTintaPct: 30,
            coberturaDisenoPct: 60,
            densidadUv: 1.5,
            costoLbCmyk: 25,
            costoLbBlanco: 30,
            costoLbPantone: 35,
            depositos: [
                { id: 'conv-deposito-blancos', tipo: 'Fondos Sólidos / Blancos', bcm: 7, gsm: 2.5 },
                { id: 'conv-deposito-textos', tipo: 'Textos y Líneas Gruesas', bcm: 4, gsm: 1.2 },
                { id: 'conv-deposito-cmyk', tipo: 'Policromía (CMYK)', bcm: 2, gsm: 1 },
                { id: 'conv-deposito-barniz', tipo: 'Barniz UV', bcm: 7, gsm: 3 }
            ]
        },
        maculaMontaje: [
            { id: 'conv-montaje-impresion', detalle: 'Impresion', porEstacion: 65, cantidadTintas: 4, totalPies: 260 },
            { id: 'conv-montaje-troquelado', detalle: 'Troquelado', porEstacion: 90, cantidadTintas: 4, totalPies: 90 },
            { id: 'conv-montaje-laminado', detalle: 'Laminado', porEstacion: 65, cantidadTintas: 4, totalPies: 65 },
            { id: 'conv-montaje-barniz', detalle: 'Barniz', porEstacion: 30, cantidadTintas: 4, totalPies: 30 },
            { id: 'conv-montaje-embosado', detalle: 'Embosado', porEstacion: 65, cantidadTintas: 4, totalPies: 65 }
        ],
        maculaTiraje: [
            { id: 'conv-tiraje-impresion', detalle: 'Impresion', porcentaje: 3 },
            { id: 'conv-tiraje-impresion-troquelado', detalle: 'Impresion + Troquelado', porcentaje: 4 },
            { id: 'conv-tiraje-impresion-troquelado-laminado', detalle: 'Impresion + Troquelado + Laminado', porcentaje: 7 },
            { id: 'conv-tiraje-impresion-troquelado-laminado-embosado', detalle: 'Impresion + Troquelado + Laminado + Embosado', porcentaje: 8 }
        ],
        finishWaste: [
            { id: 'conv-finish-barnizado', proceso: 'Barnizado', setupWasteFeet: 75, operationWastePct: 1.5 },
            { id: 'conv-finish-laminado', proceso: 'Laminado', setupWasteFeet: 100, operationWastePct: 2.0 },
            { id: 'conv-finish-troquelado', proceso: 'Troquelado', setupWasteFeet: 150, operationWastePct: 2.5 },
            { id: 'conv-finish-estampado', proceso: 'Estampado', setupWasteFeet: 250, operationWastePct: 4.0 },
            { id: 'conv-finish-embosado', proceso: 'Embosado', setupWasteFeet: 125, operationWastePct: 3.0 },
            { id: 'conv-finish-rebobinado', proceso: 'Rebobinado', setupWasteFeet: 30, operationWastePct: 0.5 }
        ]
    },
    digital: {
        maculaMontaje: [],
        maculaTiraje: []
    }
};

app.use(cors());
app.use(bodyParser.json({ limit: '20mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
if (fs.existsSync(ERP_IMPRESION_PUBLIC_DIR)) {
    app.use('/erp-impresion-assets', express.static(ERP_IMPRESION_PUBLIC_DIR));
}
ensureGeneralConfig();
ensureInventorySchema().catch((error) => {
    console.error('No fue posible preparar el esquema de inventarios:', error.message);
});
ensureProductionSchema().catch((error) => {
    console.error('No fue posible preparar el esquema de órdenes de producción:', error.message);
});
ensureAttachmentsSchema().catch((error) => {
    console.error('No fue posible preparar el esquema de adjuntos:', error.message);
});
ensureNotificationsSchema().catch((error) => {
    console.error('No fue posible preparar el esquema de notificaciones:', error.message);
});
ensureAuditSchema().catch((error) => {
    console.error('No fue posible preparar el esquema de auditoría:', error.message);
});
ensurePlanningSchema().catch((error) => {
    console.error('No fue posible preparar el esquema de planificación:', error.message);
});
ensureAdminPermissionsSchema()
    .then(() => ensureAdminUsersSchema())
    .then(() => ensureQuoteProformasSchema())
    .then(() => ensureSecuritySeed())
    .catch((error) => {
        console.error('No fue posible preparar el esquema de seguridad administrativa:', error.message);
    });

let erpImpresionHelpersPromise = null;

function ensureErpImpresionDbEnv() {
    if (process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER) {
        return;
    }

    if (!process.env.DATABASE_URL) {
        return;
    }

    try {
        const parsed = new URL(process.env.DATABASE_URL);
        process.env.DB_HOST = process.env.DB_HOST || parsed.hostname;
        process.env.DB_PORT = process.env.DB_PORT || parsed.port || '5432';
        process.env.DB_NAME = process.env.DB_NAME || parsed.pathname.replace(/^\//, '');
        process.env.DB_USER = process.env.DB_USER || decodeURIComponent(parsed.username || '');
        process.env.DB_PASSWORD = process.env.DB_PASSWORD || decodeURIComponent(parsed.password || '');
    } catch (error) {
        // Si DATABASE_URL no es parseable, dejamos que el módulo integrado siga con su manejo propio.
    }
}

async function loadErpImpresionHelpers() {
    if (!fs.existsSync(ERP_IMPRESION_HELPERS_PATH)) {
        throw new Error('No se encontró el cotizador integrado de ERP Impresión.');
    }

    if (!erpImpresionHelpersPromise) {
        ensureErpImpresionDbEnv();
        erpImpresionHelpersPromise = import(pathToFileURL(ERP_IMPRESION_HELPERS_PATH).href);
    }

    return erpImpresionHelpersPromise;
}

function renderIntegratedFlexoHtml() {
    const indexPath = path.join(ERP_IMPRESION_PUBLIC_DIR, 'index.html');
    if (!fs.existsSync(indexPath)) {
        throw new Error('No se encontró la interfaz pública del cotizador integrado.');
    }

    const raw = fs.readFileSync(indexPath, 'utf8');
    return raw
        .replace(/href="\/styles\.css"/g, 'href="/styles.css">\n  <link rel="stylesheet" href="/erp-impresion-assets/styles.css"')
        .replace(/src="\/app\.js"/g, 'src="/erp-impresion-assets/app.js"');
}

function ensureGeneralConfig() {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    if (!fs.existsSync(PUBLIC_UPLOADS_DIR)) {
        fs.mkdirSync(PUBLIC_UPLOADS_DIR, { recursive: true });
    }
    if (!fs.existsSync(LOGIN_REPOSITORY_DIR)) {
        fs.mkdirSync(LOGIN_REPOSITORY_DIR, { recursive: true });
    }

    if (!fs.existsSync(GENERAL_CONFIG_PATH)) {
        fs.writeFileSync(GENERAL_CONFIG_PATH, JSON.stringify(DEFAULT_GENERAL_CONFIG, null, 2), 'utf8');
    }
}

function sanitizeRepositoryBaseName(value, fallback = 'imagen-login') {
    const normalized = String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || fallback;
}

function extensionFromMimeType(mimeType) {
    const map = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif',
        'image/svg+xml': '.svg',
        'image/avif': '.avif'
    };
    return map[String(mimeType || '').toLowerCase()] || '';
}

function buildLoginRepositoryImageRecord(fileName, stats) {
    return {
        fileName,
        url: `${LOGIN_REPOSITORY_URL_BASE}/${encodeURIComponent(fileName)}`,
        size: Number(stats?.size || 0),
        updatedAt: stats?.mtime ? stats.mtime.toISOString() : null
    };
}

async function listLoginRepositoryImages() {
    ensureGeneralConfig();
    const entries = await fs.promises.readdir(LOGIN_REPOSITORY_DIR, { withFileTypes: true });
    const images = [];
    for (const entry of entries) {
        if (!entry.isFile()) continue;
        const fileName = entry.name;
        if (!/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(fileName)) continue;
        const fullPath = path.join(LOGIN_REPOSITORY_DIR, fileName);
        const stats = await fs.promises.stat(fullPath);
        images.push(buildLoginRepositoryImageRecord(fileName, stats));
    }
    images.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    return images;
}

async function saveLoginRepositoryImage({ fileName, dataUrl }) {
    ensureGeneralConfig();
    const match = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
        throw new Error('La imagen del repositorio no tiene un formato válido.');
    }
    const mimeType = match[1];
    const encoded = match[2];
    const extension = extensionFromMimeType(mimeType);
    if (!extension) {
        throw new Error('El formato de imagen no es compatible con el repositorio.');
    }
    const safeBase = sanitizeRepositoryBaseName(path.parse(String(fileName || '')).name || 'imagen-login');
    const finalFileName = `${Date.now()}-${safeBase}${extension}`;
    const targetPath = path.join(LOGIN_REPOSITORY_DIR, finalFileName);
    await fs.promises.writeFile(targetPath, Buffer.from(encoded, 'base64'));
    const stats = await fs.promises.stat(targetPath);
    return buildLoginRepositoryImageRecord(finalFileName, stats);
}

async function deleteLoginRepositoryImage(fileName) {
    ensureGeneralConfig();
    const safeName = path.basename(String(fileName || ''));
    if (!safeName || safeName !== fileName) {
        throw new Error('El archivo solicitado no es válido.');
    }
    const targetPath = path.join(LOGIN_REPOSITORY_DIR, safeName);
    if (!fs.existsSync(targetPath)) {
        throw new Error('La imagen indicada no existe en el repositorio.');
    }
    await fs.promises.unlink(targetPath);
}

function deepMerge(base, override) {
    if (!override || typeof override !== 'object') {
        return base;
    }

    const output = Array.isArray(base) ? [...base] : { ...base };
    for (const [key, value] of Object.entries(override)) {
        if (value && typeof value === 'object' && !Array.isArray(value) && typeof output[key] === 'object') {
            output[key] = deepMerge(output[key], value);
        } else {
            output[key] = value;
        }
    }

    return output;
}

function repairUtf8Text(value) {
    if (typeof value !== 'string' || !value) {
        return value;
    }

    let repaired = value;
    for (let index = 0; index < 2; index += 1) {
        try {
            const nextValue = decodeURIComponent(escape(repaired));
            if (!nextValue || nextValue === repaired) {
                break;
            }
            repaired = nextValue;
        } catch (error) {
            break;
        }
    }
    return repaired;
}

function fixCommonTextArtifacts(value) {
    if (typeof value !== 'string') {
        return value;
    }

    return repairUtf8Text(value)
        .replace(/^C\?lculos$/i, 'Cálculos')
        .replace(/^Cotizador Flexografia Pro$/i, 'Cálculo de Flexografía')
        .replace(/^Configuracion General/i, 'Configuración General')
        .replace(/\s+\|\s+Cotizaciones$/, ' | Cotizaciones')
        .replace(/^\|\s*/, '');
}

function cleanPresentationPayload(presentation = {}) {
    const output = {};
    for (const [key, value] of Object.entries(presentation || {})) {
        if (key === 'tabWidth' || key === 'tabHeight') {
            continue;
        }
        if (value === undefined || value === null || value === '') {
            continue;
        }
        output[key] = typeof value === 'string' ? fixCommonTextArtifacts(value) : value;
    }
    return output;
}

function splitContactName(fullName) {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) {
        return { firstName: '', lastName: '' };
    }
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: '' };
    }
    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' ')
    };
}

function normalizeFiscalId(value) {
    return String(value || '')
        .trim()
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase();
}

function sanitizePartnerCodePrefix(value) {
    const cleaned = String(value || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
    return cleaned || 'CL';
}

function buildPartnerCodeRegex(prefix) {
    return `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`;
}

async function generateNextPartnerCode(client, prefix) {
    const safePrefix = sanitizePartnerCodePrefix(prefix);
    const regex = buildPartnerCodeRegex(safePrefix);
    const result = await client.query(
        `SELECT partner_code
           FROM business_partners
          WHERE partner_code ~* $1`,
        [regex]
    );

    let maxValue = 0;
    let padLength = 5;
    for (const row of result.rows) {
        const match = String(row.partner_code || '').toUpperCase().match(new RegExp(regex, 'i'));
        if (!match) continue;
        const numeric = Number(match[1]);
        if (Number.isFinite(numeric)) {
            maxValue = Math.max(maxValue, numeric);
            padLength = Math.max(padLength, match[1].length);
        }
    }

    return `${safePrefix}${String(maxValue + 1).padStart(padLength, '0')}`;
}

async function findExistingPartnerDuplicate(client, { partnerName, taxId }) {
    const normalizedName = String(partnerName || '').trim();
    const normalizedTaxId = normalizeFiscalId(taxId);
    if (!normalizedName && !normalizedTaxId) {
        return null;
    }

    const conditions = [];
    const values = [];

    if (normalizedName) {
        values.push(normalizedName);
        conditions.push(`LOWER(TRIM(partner_name)) = LOWER(TRIM($${values.length}))`);
    }

    if (normalizedTaxId) {
        values.push(normalizedTaxId);
        conditions.push(`regexp_replace(UPPER(COALESCE(tax_id, '')), '[^A-Z0-9]', '', 'g') = $${values.length}`);
    }

    const result = await client.query(
        `SELECT partner_code, partner_name, tax_id
           FROM business_partners
          WHERE ${conditions.join(' OR ')}
          ORDER BY partner_code NULLS LAST
          LIMIT 1`,
        values
    );

    return result.rows[0] || null;
}

function buildNewPartnerRawData(payload, partnerCode) {
    return {
        socio: {
            codigo: partnerCode,
            nombre: payload.partner_name,
            identificacionFiscal: payload.tax_id,
            correoFacturacion: payload.email_facturacion,
            moneda: payload.currency_code,
            diasCredito: payload.payment_terms,
            contactoPrincipal: {
                nombre: payload.contact_name,
                identificacion: payload.contact_identification,
                celular: payload.contact_mobile,
                correo: payload.contact_email,
                telefono: payload.contact_phone
            },
            direccion: {
                pais: payload.address_country,
                provincia: payload.address_state_province,
                canton: payload.address_county,
                detalle: payload.address_line
            }
        },
        'CONTACTO NOMBRE': payload.contact_name,
        'CONTACTO IDENTIFICACION': payload.contact_identification,
        'Country Name': payload.address_country,
        'STATE NAME': payload.address_state_province,
        'CONTACTO CANTON': payload.address_county,
        STREET: payload.address_line,
        'Correo Facturacion 1': payload.email_facturacion,
        'RANGO CREDITO': payload.payment_terms,
        GROUPCODE_NOMBRE: payload.currency_code
    };
}

function normalizeGeneralConfigRecord(config) {
    const source = config || {};
    const normalized = {
        branding: deepMerge(DEFAULT_GENERAL_CONFIG.branding, source.branding || {}),
        contact: deepMerge(DEFAULT_GENERAL_CONFIG.contact, source.contact || {}),
        appearance: deepMerge(DEFAULT_GENERAL_CONFIG.appearance, source.appearance || {}),
        session: deepMerge(DEFAULT_GENERAL_CONFIG.session, source.session || {}),
        icons: deepMerge(DEFAULT_GENERAL_CONFIG.icons, source.icons || {}),
        layout: deepMerge(DEFAULT_GENERAL_CONFIG.layout, source.layout || {}),
        general: deepMerge(DEFAULT_GENERAL_CONFIG.general, source.general || {}),
        presentations: {}
    };

    const rawPresentations = { ...(source.presentations || {}) };

    if (!rawPresentations.calculos && rawPresentations.flexo) {
        rawPresentations.calculos = rawPresentations.flexo;
    }

    if (rawPresentations.inventario) {
        if (!rawPresentations['inventario-mp']) rawPresentations['inventario-mp'] = rawPresentations.inventario;
        if (!rawPresentations['inventario-troqueles']) rawPresentations['inventario-troqueles'] = rawPresentations.inventario;
        if (!rawPresentations['inventario-maquinaria']) rawPresentations['inventario-maquinaria'] = rawPresentations.inventario;
    }

    for (const key of Object.keys(PRESENTATION_NAMES)) {
        const cleaned = cleanPresentationPayload(rawPresentations[key]);
        normalized.presentations[key] = cleaned;
        if (!cleaned.moduleTitle && PRESENTATION_NAMES[key]) {
            normalized.presentations[key].moduleTitle = PRESENTATION_NAMES[key];
        }
    }

    normalized.general.moduleTitle = fixCommonTextArtifacts(normalized.general.moduleTitle);
    normalized.branding.companyName = fixCommonTextArtifacts(normalized.branding.companyName);
    normalized.general.proformaCurrenciesJson = JSON.stringify(normalizeProformaCurrencyList(normalized.general.proformaCurrenciesJson));
    normalized.general.proformaDefaultCurrency = String(normalized.general.proformaDefaultCurrency || 'CRC').trim().toUpperCase() || 'CRC';
    normalized.general.proformaHeaderColor = normalizeProformaHeaderColor(normalized.general.proformaHeaderColor, DEFAULT_GENERAL_CONFIG.general.proformaHeaderColor);
    normalized.general.proformaCompanyNameColor = normalizeProformaHeaderColor(normalized.general.proformaCompanyNameColor, DEFAULT_GENERAL_CONFIG.general.proformaCompanyNameColor);
    normalized.general.proformaShowCompanyName = String(normalized.general.proformaShowCompanyName || 'true').trim().toLowerCase() === 'false' ? 'false' : 'true';
    normalized.general.proformaLogoWidth = Number(normalized.general.proformaLogoWidth || DEFAULT_GENERAL_CONFIG.general.proformaLogoWidth) || DEFAULT_GENERAL_CONFIG.general.proformaLogoWidth;
    normalized.general.proformaLogoHeight = Number(normalized.general.proformaLogoHeight || DEFAULT_GENERAL_CONFIG.general.proformaLogoHeight) || DEFAULT_GENERAL_CONFIG.general.proformaLogoHeight;
    normalized.general.proformaLogoAspectLocked = String(normalized.general.proformaLogoAspectLocked || 'true').trim().toLowerCase() === 'false' ? 'false' : 'true';
    normalized.general.proformaLogoMarginTop = Number(normalized.general.proformaLogoMarginTop || 0) || 0;
    normalized.general.proformaLogoMarginLeft = Number(normalized.general.proformaLogoMarginLeft || 0) || 0;
    normalized.general.proformaIntroFontFamily = String(normalized.general.proformaIntroFontFamily || 'inherit').trim() || 'inherit';
    normalized.general.proformaIntroFontSize = Number(normalized.general.proformaIntroFontSize || 15) || 15;
    normalized.general.proformaIntroColor = normalizeProformaHeaderColor(normalized.general.proformaIntroColor, '#2f3c46');
    normalized.general.proformaPriceDisplayMode = String(normalized.general.proformaPriceDisplayMode || 'both').trim() || 'both';
    normalized.general.proformaSellerSignatureEnabled = String(normalized.general.proformaSellerSignatureEnabled || 'true').trim().toLowerCase() === 'false' ? 'false' : 'true';
    return normalized;
}

function loadGeneralConfigFromFile() {
    ensureGeneralConfig();
    try {
        const raw = fs.readFileSync(GENERAL_CONFIG_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return normalizeGeneralConfigRecord(parsed);
    } catch (error) {
        return DEFAULT_GENERAL_CONFIG;
    }
}

function saveGeneralConfigToFile(config) {
    ensureGeneralConfig();
    const normalized = normalizeGeneralConfigRecord(config);
    fs.writeFileSync(GENERAL_CONFIG_PATH, JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
}

async function loadGeneralConfig() {
    const fallback = loadGeneralConfigFromFile();
    try {
        const result = await pgQuery(
            `SELECT config_value
               FROM app_config
              WHERE config_key = $1
              LIMIT 1`,
            ['general']
        );
        if (!result.rows.length) {
            return fallback;
        }
        return normalizeGeneralConfigRecord(result.rows[0].config_value || {});
    } catch (error) {
        return fallback;
    }
}

async function saveGeneralConfig(config) {
    const previous = await loadGeneralConfig();
    const normalized = normalizeGeneralConfigRecord(config);
    saveGeneralConfigToFile(normalized);
    const changedBy = pickFirstValue(normalized?.session?.currentUser, previous?.session?.currentUser, getConfiguredCurrentUser());
    try {
        await pgQuery(
            `INSERT INTO app_config (config_key, config_value)
             VALUES ($1, $2::jsonb)
             ON CONFLICT (config_key)
             DO UPDATE SET
                config_value = EXCLUDED.config_value,
                updated_at = NOW()`,
            ['general', JSON.stringify(normalized)]
        );
    } catch (error) {
        return normalized;
    }
    await recordAuditDiff({
        moduleKey: 'configuracion',
        entityType: 'app_config',
        entityKey: 'general',
        beforeValue: previous,
        afterValue: normalized,
        changedBy
    });
    return normalized;
}

function normalizeCostsRowId(value, fallback) {
    const text = String(value || '').trim();
    return text || fallback;
}

function normalizeCostsConfigRecord(config) {
    const source = config || {};
    const normalizeCoreDiameterOptions = (value, fallback = DEFAULT_COSTS_CONFIG.general.coreDiameterOptions) => {
        if (Array.isArray(value)) {
            const items = value.map((item) => String(item || '').trim()).filter(Boolean);
            return items.length ? items.slice(0, 5) : [...fallback];
        }
        const text = String(value || '').trim();
        if (!text) return [...fallback];
        const items = text.split(',').map((item) => String(item || '').trim()).filter(Boolean);
        return items.length ? items.slice(0, 5) : [...fallback];
    };
    const normalizeDepositos = (rows = [], prefix) => (Array.isArray(rows) ? rows : []).map((row, index) => ({
        id: normalizeCostsRowId(row?.id, `${prefix}-deposito-${index + 1}`),
        tipo: String(row?.tipo || '').trim(),
        bcm: Number(row?.bcm || 0),
        gsm: Number(row?.gsm || 0)
    }));
    const normalizeMontaje = (rows = [], prefix) => (Array.isArray(rows) ? rows : []).map((row, index) => ({
        id: normalizeCostsRowId(row?.id, `${prefix}-montaje-${index + 1}`),
        detalle: String(row?.detalle || '').trim(),
        porEstacion: Number(row?.porEstacion || 0),
        cantidadTintas: Number(row?.cantidadTintas || 0),
        totalPies: Number(row?.totalPies || 0)
    }));
    const normalizeTiraje = (rows = [], prefix) => (Array.isArray(rows) ? rows : []).map((row, index) => ({
        id: normalizeCostsRowId(row?.id, `${prefix}-tiraje-${index + 1}`),
        detalle: String(row?.detalle || '').trim(),
        porcentaje: Number(row?.porcentaje || 0)
    }));
    const normalizeFinishWaste = (rows = [], prefix) => (Array.isArray(rows) ? rows : []).map((row, index) => ({
        id: normalizeCostsRowId(row?.id, `${prefix}-finish-${index + 1}`),
        proceso: String(row?.proceso || '').trim(),
        setupWasteFeet: Number(row?.setupWasteFeet || 0),
        operationWastePct: Number(row?.operationWastePct || 0)
    }));

    return {
        general: {
            notes: String(source?.general?.notes || DEFAULT_COSTS_CONFIG.general.notes || '').trim(),
            updatedAt: source?.general?.updatedAt || DEFAULT_COSTS_CONFIG.general.updatedAt || null,
            defaultRollWidth: Number(source?.general?.defaultRollWidth || DEFAULT_COSTS_CONFIG.general.defaultRollWidth || 0),
            defaultCoreDiameter: Number(source?.general?.defaultCoreDiameter || DEFAULT_COSTS_CONFIG.general.defaultCoreDiameter || 0),
            coreDiameterOptions: normalizeCoreDiameterOptions(source?.general?.coreDiameterOptions, DEFAULT_COSTS_CONFIG.general.coreDiameterOptions),
            defaultQuantityTypes: Number(source?.general?.defaultQuantityTypes || DEFAULT_COSTS_CONFIG.general.defaultQuantityTypes || 1),
            defaultCmykEnabled: String(source?.general?.defaultCmykEnabled || DEFAULT_COSTS_CONFIG.general.defaultCmykEnabled || 'true').trim().toLowerCase() === 'false' ? 'false' : 'true'
        },
        convencional: {
            tintaGeneral: {
                bcmGenerico: Number(source?.convencional?.tintaGeneral?.bcmGenerico || DEFAULT_COSTS_CONFIG.convencional.tintaGeneral.bcmGenerico || 0),
                coberturaTintaPct: Number(source?.convencional?.tintaGeneral?.coberturaTintaPct || DEFAULT_COSTS_CONFIG.convencional.tintaGeneral.coberturaTintaPct || 0),
                coberturaDisenoPct: Number(source?.convencional?.tintaGeneral?.coberturaDisenoPct || DEFAULT_COSTS_CONFIG.convencional.tintaGeneral.coberturaDisenoPct || 0),
                densidadUv: Number(source?.convencional?.tintaGeneral?.densidadUv || DEFAULT_COSTS_CONFIG.convencional.tintaGeneral.densidadUv || 0),
                costoLbCmyk: Number(source?.convencional?.tintaGeneral?.costoLbCmyk || DEFAULT_COSTS_CONFIG.convencional.tintaGeneral.costoLbCmyk || 0),
                costoLbBlanco: Number(source?.convencional?.tintaGeneral?.costoLbBlanco || DEFAULT_COSTS_CONFIG.convencional.tintaGeneral.costoLbBlanco || 0),
                costoLbPantone: Number(source?.convencional?.tintaGeneral?.costoLbPantone || DEFAULT_COSTS_CONFIG.convencional.tintaGeneral.costoLbPantone || 0),
                depositos: normalizeDepositos(source?.convencional?.tintaGeneral?.depositos || DEFAULT_COSTS_CONFIG.convencional.tintaGeneral.depositos, 'convencional')
            },
            maculaMontaje: normalizeMontaje(source?.convencional?.maculaMontaje || DEFAULT_COSTS_CONFIG.convencional.maculaMontaje, 'convencional'),
            maculaTiraje: normalizeTiraje(source?.convencional?.maculaTiraje || DEFAULT_COSTS_CONFIG.convencional.maculaTiraje, 'convencional'),
            finishWaste: normalizeFinishWaste(source?.convencional?.finishWaste || DEFAULT_COSTS_CONFIG.convencional.finishWaste, 'convencional')
        },
        digital: {
            maculaMontaje: normalizeMontaje(source?.digital?.maculaMontaje || DEFAULT_COSTS_CONFIG.digital.maculaMontaje, 'digital'),
            maculaTiraje: normalizeTiraje(source?.digital?.maculaTiraje || DEFAULT_COSTS_CONFIG.digital.maculaTiraje, 'digital')
        }
    };
}

async function loadCostsConfig() {
    const fallback = normalizeCostsConfigRecord(DEFAULT_COSTS_CONFIG);
    try {
        const result = await pgQuery(
            `SELECT config_value
               FROM app_config
              WHERE config_key = $1
              LIMIT 1`,
            ['costos']
        );
        if (!result.rows.length) {
            return fallback;
        }
        return normalizeCostsConfigRecord(result.rows[0].config_value || {});
    } catch (error) {
        return fallback;
    }
}

async function saveCostsConfig(config) {
    const normalized = normalizeCostsConfigRecord(config);
    normalized.general.updatedAt = new Date().toISOString();
    const previous = await loadCostsConfig();
    try {
        await pgQuery(
            `INSERT INTO app_config (config_key, config_value)
             VALUES ($1, $2::jsonb)
             ON CONFLICT (config_key)
             DO UPDATE SET
                config_value = EXCLUDED.config_value,
                updated_at = NOW()`,
            ['costos', JSON.stringify(normalized)]
        );
    } catch (error) {
        return normalized;
    }
    await recordAuditDiff({
        moduleKey: 'costos',
        entityType: 'app_config',
        entityKey: 'costos',
        beforeValue: previous,
        afterValue: normalized,
        changedBy: getConfiguredCurrentUser()
    });
    return normalized;
}

function prettifyAuditToken(value) {
    return String(value || '')
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

const AUDIT_PRESENTATION_LABELS = {
    ...PRESENTATION_NAMES,
    general: 'General',
    costos: 'Costos'
};

const AUDIT_FIELD_LABELS = {
    branding: 'Branding',
    contact: 'Contacto',
    general: 'General',
    layout: 'Layout',
    icons: 'Iconos',
    session: 'Sesión',
    notes: 'Notas',
    updatedAt: 'Actualizado En',
    bcmGenerico: 'BCM Genérico',
    coberturaTintaPct: 'Cobertura Tinta',
    coberturaDisenoPct: 'Cobertura Diseño',
    densidadUv: 'Densidad UV',
    costoLbCmyk: 'Costo Lb CMYK',
    costoLbBlanco: 'Costo Lb Blanco',
    costoLbPantone: 'Costo Lb Pantone',
    depositos: 'Depósitos',
    maculaMontaje: 'Mácula Montaje',
    maculaTiraje: 'Mácula Tiraje',
    tipo: 'Tipo',
    bcm: 'BCM',
    gsm: 'GSM',
    detalle: 'Detalle',
    porEstacion: 'Por Estación',
    cantidadTintas: 'Cantidad Tintas',
    totalPies: 'Total Pies',
    porcentaje: 'Porcentaje'
};

function getAuditFieldLabel(token) {
    return AUDIT_FIELD_LABELS[token] || prettifyAuditToken(token);
}

function normalizeAuditPrimitive(value) {
    if (value === undefined) return null;
    if (value === '') return '';
    if (value === null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'boolean') return value;
    return String(value);
}

function flattenAuditObject(value, path = [], rows = {}) {
    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            const rowKey = item && typeof item === 'object'
                ? String(item.id || item.key || item.tipo || item.detalle || index + 1).trim()
                : String(index + 1);
            flattenAuditObject(item, [...path, rowKey], rows);
        });
        return rows;
    }
    if (value && typeof value === 'object') {
        Object.entries(value).forEach(([key, nested]) => {
            flattenAuditObject(nested, [...path, key], rows);
        });
        return rows;
    }
    rows[path.join('.')] = normalizeAuditPrimitive(value);
    return rows;
}

function buildAuditMetadata(moduleKey, pathKey) {
    const parts = String(pathKey || '').split('.').filter(Boolean);
    let presentationKey = moduleKey;
    let sectionKey = parts[0] || '';
    let rowKey = '';
    let rowLabel = '';
    let fieldKey = parts[parts.length - 1] || '';
    let fieldLabel = getAuditFieldLabel(fieldKey);

    if (moduleKey === 'configuracion') {
        if (parts[0] === 'presentations') {
            presentationKey = parts[1] || 'presentaciones';
            sectionKey = parts[2] || '';
            fieldKey = parts[parts.length - 1] || '';
            fieldLabel = getAuditFieldLabel(fieldKey);
        } else {
            presentationKey = 'general';
            sectionKey = parts[0] || '';
        }
    }

    if (moduleKey === 'costos') {
        presentationKey = 'costos';
        sectionKey = parts[0] || '';
        if (parts.includes('depositos') || parts.includes('maculaMontaje') || parts.includes('maculaTiraje')) {
            rowKey = parts[2] || '';
            rowLabel = prettifyAuditToken(rowKey);
        }
    }

    return {
        presentationKey,
        presentationLabel: AUDIT_PRESENTATION_LABELS[presentationKey] || prettifyAuditToken(presentationKey),
        sectionKey,
        sectionLabel: getAuditFieldLabel(sectionKey),
        fieldKey,
        fieldLabel,
        rowKey,
        rowLabel
    };
}

function formatAuditDisplayValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
}

async function ensureAuditSchema() {
    await pgQuery(`
        CREATE TABLE IF NOT EXISTS audit_log (
            id BIGSERIAL PRIMARY KEY,
            module_key TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_key TEXT NOT NULL,
            presentation_key TEXT,
            presentation_label TEXT,
            section_key TEXT,
            section_label TEXT,
            row_key TEXT,
            row_label TEXT,
            field_key TEXT NOT NULL,
            field_label TEXT,
            old_value JSONB,
            new_value JSONB,
            old_value_display TEXT,
            new_value_display TEXT,
            changed_by TEXT,
            route TEXT,
            changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await pgQuery(`CREATE INDEX IF NOT EXISTS audit_log_module_idx ON audit_log (module_key, changed_at DESC)`);
    await pgQuery(`CREATE INDEX IF NOT EXISTS audit_log_presentation_idx ON audit_log (presentation_key, changed_at DESC)`);
    await pgQuery(`CREATE INDEX IF NOT EXISTS audit_log_user_idx ON audit_log (changed_by, changed_at DESC)`);
}

async function insertAuditEntries(entries = []) {
    if (!entries.length) return;
    for (const entry of entries) {
        await pgQuery(
            `INSERT INTO audit_log (
                module_key, entity_type, entity_key, presentation_key, presentation_label,
                section_key, section_label, row_key, row_label, field_key, field_label,
                old_value, new_value, old_value_display, new_value_display, changed_by, route
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15,$16,$17
            )`,
            [
                entry.moduleKey,
                entry.entityType,
                entry.entityKey,
                entry.presentationKey || null,
                entry.presentationLabel || null,
                entry.sectionKey || null,
                entry.sectionLabel || null,
                entry.rowKey || null,
                entry.rowLabel || null,
                entry.fieldKey,
                entry.fieldLabel || null,
                entry.oldValue === undefined ? null : JSON.stringify(entry.oldValue),
                entry.newValue === undefined ? null : JSON.stringify(entry.newValue),
                formatAuditDisplayValue(entry.oldValue),
                formatAuditDisplayValue(entry.newValue),
                entry.changedBy || getConfiguredCurrentUser(),
                entry.route || null
            ]
        );
    }
}

async function recordAuditDiff({ moduleKey, entityType, entityKey, beforeValue, afterValue, changedBy, route }) {
    const beforeFlat = flattenAuditObject(beforeValue || {});
    const afterFlat = flattenAuditObject(afterValue || {});
    const ignoredFields = new Set(['general.updatedAt']);
    const keys = new Set([...Object.keys(beforeFlat), ...Object.keys(afterFlat)]);
    const entries = [];

    keys.forEach((pathKey) => {
        if (ignoredFields.has(pathKey)) return;
        const previous = beforeFlat[pathKey];
        const next = afterFlat[pathKey];
        if (JSON.stringify(previous) === JSON.stringify(next)) return;
        const meta = buildAuditMetadata(moduleKey, pathKey);
        entries.push({
            moduleKey,
            entityType,
            entityKey,
            ...meta,
            oldValue: previous,
            newValue: next,
            changedBy,
            route
        });
    });

    await insertAuditEntries(entries);
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .toLowerCase();
}

function sanitizeAdminUserText(value, fallback = '') {
    return String(value ?? fallback).trim();
}

function normalizeProformaCurrencyList(value, fallbackJson = DEFAULT_GENERAL_CONFIG.general.proformaCurrenciesJson) {
    const fallback = (() => {
        try {
            return JSON.parse(fallbackJson);
        } catch (error) {
            return [{ code: 'CRC', label: 'Colones', symbol: '₡', exchangeRate: 1 }];
        }
    })();
    const input = typeof value === 'string'
        ? (() => {
            try {
                return JSON.parse(value);
            } catch (error) {
                return [];
            }
        })()
        : value;
    const rows = Array.isArray(input) ? input : [];
    const normalized = rows.map((row) => ({
        code: String(row?.code || '').trim().toUpperCase().slice(0, 10),
        label: String(row?.label || '').trim().slice(0, 80),
        symbol: String(row?.symbol || '').trim().slice(0, 10),
        exchangeRate: Number(row?.exchangeRate || 0)
    })).filter((row) => row.code && row.label && Number.isFinite(row.exchangeRate) && row.exchangeRate > 0);
    return normalized.length ? normalized : fallback;
}

function normalizeAdminUserRecord(row = {}) {
    return {
        id: Number(row.id || 0),
        name: sanitizeAdminUserText(row.full_name),
        username: sanitizeAdminUserText(row.username),
        password: sanitizeAdminUserText(row.password),
        department: sanitizeAdminUserText(row.department),
        process: sanitizeAdminUserText(row.process),
        photoUrl: sanitizeAdminUserText(row.photo_url),
        signatureUrl: sanitizeAdminUserText(row.signature_url),
        permissionId: row.permission_id == null ? null : Number(row.permission_id),
        permissionName: sanitizeAdminUserText(row.permission_name)
    };
}

async function ensureAdminUsersSchema() {
    await pgQuery(`
        CREATE TABLE IF NOT EXISTS admin_users (
            id BIGSERIAL PRIMARY KEY,
            full_name TEXT NOT NULL,
            username TEXT NOT NULL DEFAULT '',
            password TEXT NOT NULL DEFAULT '',
            department TEXT NOT NULL DEFAULT '',
            process TEXT NOT NULL DEFAULT '',
            photo_url TEXT NOT NULL DEFAULT '',
            signature_url TEXT NOT NULL DEFAULT '',
            permission_id BIGINT REFERENCES admin_permissions(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await pgQuery(`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS permission_id BIGINT REFERENCES admin_permissions(id) ON DELETE SET NULL`);
    await pgQuery(`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS signature_url TEXT NOT NULL DEFAULT ''`);
    await pgQuery(`CREATE INDEX IF NOT EXISTS admin_users_name_idx ON admin_users (full_name)`);
}

async function ensureQuoteProformasSchema() {
    await pgQuery(`
        CREATE TABLE IF NOT EXISTS quote_proformas (
            id BIGSERIAL PRIMARY KEY,
            quote_code TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'open',
            issue_date_fixed TIMESTAMPTZ NULL,
            closed_at TIMESTAMPTZ NULL,
            closed_reason TEXT NOT NULL DEFAULT '',
            raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await pgQuery(`CREATE INDEX IF NOT EXISTS quote_proformas_quote_code_idx ON quote_proformas (quote_code)`);
}

function sanitizePermissionAccess(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'view' || normalized === 'edit') return normalized;
    return 'none';
}

function sanitizePresentationKey(value) {
    const normalized = String(value || '').trim();
    return PRESENTATION_NAMES[normalized] ? normalized : 'dashboard';
}

function normalizePermissionMatrix(input = {}) {
    const output = {};
    Object.keys(PRESENTATION_NAMES).forEach((key) => {
        output[key] = sanitizePermissionAccess(input[key]);
    });
    return output;
}

function normalizeAdminPermissionRecord(row = {}) {
    return {
        id: Number(row.id || 0),
        name: sanitizeAdminUserText(row.permission_name),
        defaultLanding: sanitizePresentationKey(row.default_landing),
        modules: normalizePermissionMatrix(row.module_permissions || {})
    };
}

async function ensureAdminPermissionsSchema() {
    await pgQuery(`
        CREATE TABLE IF NOT EXISTS admin_permissions (
            id BIGSERIAL PRIMARY KEY,
            permission_name TEXT NOT NULL,
            default_landing TEXT NOT NULL DEFAULT 'dashboard',
            module_permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await pgQuery(`CREATE INDEX IF NOT EXISTS admin_permissions_name_idx ON admin_permissions (permission_name)`);
}

async function ensureSecuritySeed() {
    const permissionsCount = await pgQuery(`SELECT COUNT(*)::int AS total FROM admin_permissions`);
    let adminPermissionId = null;

    if (Number(permissionsCount.rows[0]?.total || 0) === 0) {
        const fullAccess = {};
        Object.keys(PRESENTATION_NAMES).forEach((key) => {
            fullAccess[key] = 'edit';
        });
        const insertedPermission = await pgQuery(
            `INSERT INTO admin_permissions (permission_name, default_landing, module_permissions)
             VALUES ($1, $2, $3::jsonb)
             RETURNING id`,
            ['Administrador', 'dashboard', JSON.stringify(fullAccess)]
        );
        adminPermissionId = Number(insertedPermission.rows[0]?.id || 0) || null;
    } else {
        const permissionRow = await pgQuery(
            `SELECT id
               FROM admin_permissions
              ORDER BY CASE WHEN LOWER(permission_name) = 'administrador' THEN 0 ELSE 1 END, id
              LIMIT 1`
        );
        adminPermissionId = Number(permissionRow.rows[0]?.id || 0) || null;
    }

    const usersCount = await pgQuery(`SELECT COUNT(*)::int AS total FROM admin_users`);
    if (Number(usersCount.rows[0]?.total || 0) === 0) {
        await pgQuery(
            `INSERT INTO admin_users (full_name, username, password, department, process, photo_url, signature_url, permission_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            ['Administrador', 'admin', 'admin', 'Administración', 'General', '', '', adminPermissionId]
        );
    }
}

function renderSellerMobileHtml() {
    return fs.readFileSync(path.join(__dirname, 'public', 'vendedores-mobile.html'), 'utf8');
}

function isPhoneUserAgent(userAgent) {
    return /android.+mobile|iphone|ipod|windows phone|blackberry|opera mini|mobile/i.test(String(userAgent || ''));
}

async function shouldServeSellerMobile(req) {
    const forcedMobile = String(req.query.mobilePreview || '').trim() === '1' || String(req.query.view || '').trim() === 'mobile';
    const forcedDesktop = String(req.query.mobilePreview || '').trim() === '0' || String(req.query.view || '').trim() === 'desktop';
    if (forcedMobile) return true;
    if (forcedDesktop) return false;

    const config = await loadGeneralConfig();
    const enabled = String(config?.general?.mobileSellerAutoRoute ?? 'true') !== 'false';
    if (!enabled) return false;
    return isPhoneUserAgent(req.headers['user-agent']);
}

function isDigitalPrintingReference(value) {
    const normalized = normalizeText(value);
    return normalized.includes('digit') || normalized.includes('hp');
}

function hasDigitalPrintingContext({ processType = '', machineName = '', raw = {} } = {}) {
    return isDigitalPrintingReference([
        processType,
        machineName,
        raw['DIGITAL | MAQUINA'],
        raw['CONV | MAQUINA'],
        raw['MAQUINA IMPRESION']
    ].filter(Boolean).join(' '));
}

function zeroDigitalPlateCostFields(rawData = {}) {
    rawData['GENERAL | 4 | COSTO CYREL'] = 0;
    return rawData;
}

function slugify(value) {
    return normalizeText(value).replace(/\s+/g, '_');
}

function toNumber(value, fallback = 0) {
    if (value === '' || value === null || typeof value === 'undefined') {
        return fallback;
    }

    const normalized = typeof value === 'string'
        ? value.replace(/\./g, '').replace(',', '.')
        : value;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function roundCurrency(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function readWorkbookRows(fileName) {
    const fullPath = path.join(DATA_ROOT, fileName);
    if (!fs.existsSync(fullPath)) {
        return [];
    }

    const workbook = XLSX.readFile(fullPath, { cellDates: true });
    const [firstSheet] = workbook.SheetNames;
    const sheet = workbook.Sheets[firstSheet];
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function classifyMachineCategory(process, subprocess) {
    const raw = `${process} ${subprocess}`.toLowerCase();

    if (raw.includes('impresi')) return 'impresion';
    if (raw.includes('troquel')) return 'troquelado';
    if (raw.includes('laminad')) return 'laminado';
    if (raw.includes('estamp')) return 'estampado';
    if (raw.includes('rebobin')) return 'rebobinado';
    if (raw.includes('empaque')) return 'empaque';
    if (raw.includes('preprensa')) return 'preprensa';
    if (raw.includes('barniz')) return 'barniz';

    return 'otros';
}

function loadMachineCatalog() {
    return readWorkbookRows('Inventario de Maquinas Flexo.xlsx').map((row) => {
        const normalizedRow = Object.fromEntries(
            Object.entries(row || {}).map(([key, value]) => [repairUtf8Text(String(key || '')), value])
        );
        const machineName = normalizedRow['Nombre de la máquina'] || normalizedRow.Modelo || normalizedRow.Marca || 'Sin nombre';
        const process = normalizedRow.Proceso || '';
        const subprocess = normalizedRow.Subproceso || '';

        return {
            id: slugify(`${machineName}-${process}-${subprocess}`),
            brand: normalizedRow.Marca || '',
            model: normalizedRow.Modelo || '',
            machineName,
            process,
            subprocess,
            category: classifyMachineCategory(process, subprocess),
            workUnit: normalizedRow['Unidad de trabajo'] || '',
            setupBaseMinutes: toNumber(normalizedRow['Tiempo de preparación general (sin estaciones)'], 0),
            setupPerStationMinutes: toNumber(normalizedRow['Tiempo por estación'], 0),
            setupExtraMinutes: toNumber(normalizedRow['Tiempo adicional de preparación'], 0),
            areaFactor: toNumber(normalizedRow['Factor de proceso por área'], 0),
            processVariables: normalizedRow['Variables que afectan el tiempo'] || '',
            consumptionType: normalizedRow['Tipo de consumo'] || '',
            productionSpeed: toNumber(normalizedRow['Velocidad de producción'], 0),
            hourlyMachineCost: toNumber(normalizedRow['Costo Hora Maquina'], 0),
            hourlyOperatorCost: toNumber(normalizedRow['Costo por hora del operador'], 0),
            timeFormula: normalizedRow['Formula Calculo Tiempo'] || '',
            costFormula: normalizedRow['Fórmula Calculo Costo'] || ''
        };
    }).filter((machine) => machine.machineName);
}

function loadMaterialsCatalog() {
    return readWorkbookRows('Inventario de Materia Prima Flexo.xlsx').map((row) => ({
        id: String(row['Id Material'] || '').trim(),
        name: row.Nombre || row['Descripcion con Medidas'] || '',
        displayName: row['Descripcion con Medidas'] || row['Descripcion para Proforma'] || row.Nombre || '',
        presentationType: row['Tipo Presentacion'] || '',
        active: String(row['Material Activo | Check'] || '').toUpperCase() === 'SI',
        conventionalEnabled: String(row['Material Flexo Conv | Check'] || '').toUpperCase() === 'SI',
        digitalEnabled: String(row['Material Flexo Digital | Check'] || '').toUpperCase() === 'SI',
        widthInches: toNumber(row['Dimensiones | Ancho'], null),
        lengthValue: toNumber(row['Dimensiones | Largo'], null),
        costPerKgUsd: toNumber(row['Precio por KG | Cotizacion | Dol'], null),
        costPerLinearMeterUsd: toNumber(row['Precio por Metro Lineal | Cotizacion | Dol'], null),
        costPerUnitUsd: toNumber(row['Precio Unitario | Cotizacion | Dol'], null),
        provider: row.Proveedor || ''
    })).filter((material) => material.id);
}

function loadDieCatalog() {
    return readWorkbookRows('Troqueles Flexo.xlsx').map((row) => ({
        id: String(row['Id Troquel'] || '').trim(),
        description: row['Descripcion Troquel'] || row['Descripcion Troquel COTIZACIONES'] || '',
        category: row.Clasificacion || row['TIPO TROQUEL'] || '',
        dimensions: row['Dimensiones Troquel'] || '',
        teeth: toNumber(row.Dientes, null),
        rows: toNumber(row.Filas, null),
        repetitions: toNumber(row.Repeticiones, null),
        materialWidth: toNumber(row['Ancho Material'], null),
        status: row['Estado Troquel'] || '',
        useDigital: String(row['USO DIGITAL'] || '').toUpperCase() === 'SI' || normalizeText(row['Tipo de troquel2']).includes('vericut'),
        useConventional: String(row['USO CONVENCIONAL'] || '').toUpperCase() === 'SI' || normalizeText(row['Tipo de troquel2']).includes('convencional')
    })).filter((die) => die.id);
}

function loadProductCatalog() {
    return readWorkbookRows('Catalogo Productos Flexografia.xlsx').map((row) => ({
        id: String(row['Id Producto'] || '').trim(),
        lineId: String(row['Id Linea'] || '').trim(),
        quoteId: String(row['Id Cotizacion'] || '').trim(),
        clientId: String(row['Cliente | ID'] || '').trim(),
        clientName: row.Cliente || '',
        code: String(row['Codigo Producto'] || '').trim(),
        jobName: row['Nombre Trabajo'] || '',
        productType: row['Tipo Producto'] || '',
        department: row.Departamento || '',
        materialName: row.Material || '',
        quotedMachine: row['Maquina Cotizada'] || '',
        dieId: row['TROQUEL | ID'] || '',
        labelsPerRoll: toNumber(row['Cantidad Etiquetas x Rollo'], null),
        coreWidth: toNumber(row['Ancho Core'], null),
        coreDiameter: row['Diametro Core'] || '',
        totalFeetQuoted: toNumber(row['Total Pies Cotizados'], null),
        quantityProducts: toNumber(row['Cantidad Productos'], null),
        quantityTypes: toNumber(row['Cantidad Tipos Cotizados'], null),
        tintCount: toNumber(row['Cantidad Tintas'], null),
        priceUnit: toNumber(row['PRECIO UNITARIO'], null),
        totalPrice: toNumber(row['PRECIO TOTAL'], null),
        currency: row.MONEDA || '',
        outputType: row['Tipo Salida | Nombre a Mostrar'] || row['Tipo Salida | ID'] || '',
        applicationType: row['TIPO ETIQUETADO'] || '',
        width: toNumber(row['Dimension | Ancho Decimal'], null),
        length: toNumber(row['Dimension | Largo Decimal'], null),
        whiteInk: String(row['TINTA BLANCA | CHECK'] || '').toUpperCase() === 'SI',
        doubleWhite: String(row['TINTA BLANCA | DOBLE PASADA | CHECK'] || '').toUpperCase() === 'SI'
    })).filter((product) => product.id);
}

function loadGlobalCostConfig() {
    const [row] = readWorkbookRows('Costos Flexo.xlsx');
    if (!row) {
        return { commercialSettings: {}, processDefaults: {}, rawFields: {} };
    }

    return {
        commercialSettings: {
            exchangeRateFixed: toNumber(row['TIPO CAMBIO FIJO'], null),
            profitabilityPercent: toNumber(row['Porcentaje Rendimiento'], null),
            profitabilityMinPercent: toNumber(row['Porcentaje Minimo'], null),
            profitabilityMaxPercent: toNumber(row['Porcentaje Maximo'], null),
            contingencyPercent: toNumber(row['Porcentaje Imprevistos'], null),
            financialPercent: toNumber(row['Porcentaje Financieros'], null),
            extraPercent: toNumber(row['Porcentaje Adicional'], null),
            digitalPercent: toNumber(row['Porcentaje | Flexo Digital'], null),
            conventionalPercent: toNumber(row['Porcentaje | Flexo Convencional'], null),
            minimumCost: toNumber(row['COSTOS | COSTO MINIMO'], null)
        },
        processDefaults: {
            sri: {
                minuteCost: toNumber(row['COSTOS | SRI | MINUTO MAQUINA'], null),
                hourCost: toNumber(row['COSTOS | SRI | HORA MAQUINA'], null),
                runFactor: toNumber(row['COSTOS | SRI | FACTOR TIRAJE'], null),
                setupFactor: toNumber(row['COSTOS | SRI | FACTOR MONTAJE'], null)
            },
            packaging: {
                setupMinutes: toNumber(row['Costos | Empaque Flex | Tiempo Setup'], null),
                unitsPerMinute: toNumber(row['Costos | Empaque Flex | Productos x Minuto'], null),
                machineMinuteCost: toNumber(row['Costos | Empaque Flex | Minuto Maquina'], null),
                machineHourCost: toNumber(row['Costos | Empaque Flex | Hora Maquina'], null)
            }
        },
        rawFields: row
    };
}

function loadFlexoCatalogs() {
    const machines = loadMachineCatalog();
    const machineCategories = machines.reduce((accumulator, machine) => {
        if (!accumulator[machine.category]) {
            accumulator[machine.category] = [];
        }
        accumulator[machine.category].push(machine);
        return accumulator;
    }, {});

    return {
        machines,
        machineCategories,
        materials: loadMaterialsCatalog(),
        dies: loadDieCatalog(),
        products: loadProductCatalog(),
        globalCosts: loadGlobalCostConfig()
    };
}

function calcularCotizacionFlexografia(payload) {
    const proceso = payload.proceso === 'digital' ? 'digital' : 'convencional';
    const cantidad = Math.max(0, Math.ceil(toNumber(payload.cantidad)));
    const anchoEtiqueta = Math.max(0, toNumber(payload.anchoEtiqueta));
    const altoEtiqueta = Math.max(0, toNumber(payload.altoEtiqueta));
    const anchoRollo = Math.max(anchoEtiqueta, toNumber(payload.anchoRollo));
    const separacionHorizontal = Math.max(0, toNumber(payload.separacionHorizontal));
    const separacionVertical = Math.max(0, toNumber(payload.separacionVertical));
    const mermaPorcentaje = Math.max(0, toNumber(payload.mermaPorcentaje, proceso === 'digital' ? 5 : 8));
    const cantidadCambios = Math.max(1, Math.ceil(toNumber(payload.cantidadCambios, 1)));
    const cantidadPantones = Math.max(0, Math.ceil(toNumber(payload.cantidadPantones)));
    const usaBlanco = Boolean(payload.usaBlanco);
    const doblePasadaBlanco = Boolean(payload.doblePasadaBlanco);
    const cmyk = Boolean(payload.cmyk);
    const tintasBase = (cmyk ? 4 : 0) + cantidadPantones + (usaBlanco ? 1 : 0);
    const tintasEfectivas = Math.max(1, tintasBase + (usaBlanco && doblePasadaBlanco ? 1 : 0));
    const pasosPorLinea = Math.max(1, Math.floor((anchoRollo + separacionHorizontal) / Math.max(0.01, anchoEtiqueta + separacionHorizontal)));
    const filas = cantidad > 0 ? Math.ceil(cantidad / pasosPorLinea) : 0;
    const largoTotalPulgadas = filas * (altoEtiqueta + separacionVertical);
    const piesLineales = largoTotalPulgadas / 12;
    const msiBase = (anchoRollo * largoTotalPulgadas) / 1000;
    const factorMerma = 1 + (mermaPorcentaje / 100);
    const piesLinealesConMerma = piesLineales * factorMerma;
    const msiConMerma = msiBase * factorMerma;
    const costoMaterialPorMsi = toNumber(payload.costoMaterialPorMsi);
    const costoMaterialPorKg = toNumber(payload.costoMaterialPorKg);
    const gramaje = Math.max(0, toNumber(payload.gramaje));
    const areaM2 = (anchoRollo * 0.0254) * (largoTotalPulgadas * 0.0254);
    const pesoKg = areaM2 * (gramaje / 1000) * factorMerma;
    const costoMaterial = costoMaterialPorKg > 0 && gramaje > 0 ? pesoKg * costoMaterialPorKg : msiConMerma * costoMaterialPorMsi;
    const costoHoraPreprensa = toNumber(payload.costoHoraPreprensa);
    const minutosPreprensaPorCambio = toNumber(payload.minutosPreprensaPorCambio, 10);
    const costoPreprensaBase = Boolean(payload.incluirPreprensa) ? costoHoraPreprensa : 0;
    const costoPreprensaCambios = cantidadCambios > 1 ? (cantidadCambios - 1) * minutosPreprensaPorCambio * (costoHoraPreprensa / 60) : 0;
    const costoPreprensa = costoPreprensaBase + costoPreprensaCambios;
    const costoMinutoMaquina = toNumber(payload.costoMinutoMaquina);
    const factorMontajePorEstacion = toNumber(payload.factorMontajePorEstacion, proceso === 'digital' ? 4 : 6);
    const costoMontaje = proceso === 'convencional' ? tintasEfectivas * factorMontajePorEstacion * cantidadCambios * costoMinutoMaquina : 0;
    const costoTintaPorMsi = toNumber(payload.costoTintaPorMsi, proceso === 'digital' ? 0.18 : 0.12);
    const costoTintas = msiConMerma * costoTintaPorMsi * tintasEfectivas;
    const piesPorMinuto = Math.max(0.01, toNumber(payload.piesPorMinuto, proceso === 'digital' ? 120 : 180));
    const minutosTiraje = piesLinealesConMerma / piesPorMinuto;
    const costoTiraje = minutosTiraje * costoMinutoMaquina;
    const costoLaminadoPorMsi = toNumber(payload.costoLaminadoPorMsi);
    const setupLaminado = toNumber(payload.setupLaminado);
    const costoLaminado = Boolean(payload.incluirLaminado) ? (msiConMerma * costoLaminadoPorMsi) + setupLaminado : 0;
    const costoBarnizPorMsi = toNumber(payload.costoBarnizPorMsi);
    const costoBarniz = Boolean(payload.incluirBarniz) ? msiConMerma * costoBarnizPorMsi : 0;
    const costoTroquel = Boolean(payload.incluirTroquel) ? toNumber(payload.costoTroquel) : 0;
    const costoArte = Boolean(payload.incluirArte) ? toNumber(payload.costoArte) : 0;
    const costoCyrel = Boolean(payload.incluirCyrel) ? toNumber(payload.costoCyrel) : 0;
    const costoMaquila = Boolean(payload.incluirMaquila) ? toNumber(payload.costoMaquila) : 0;
    const costoFlete = Boolean(payload.incluirFlete) ? toNumber(payload.costoFlete) : 0;
    const costoEmpaque = toNumber(payload.costoEmpaque);
    const costoProductivo = costoMaterial + costoPreprensa + costoMontaje + costoTintas + costoTiraje + costoLaminado + costoBarniz + costoTroquel + costoArte + costoCyrel + costoMaquila + costoFlete + costoEmpaque;
    const porcentajeImprevistos = toNumber(payload.porcentajeImprevistos, 3) / 100;
    const porcentajeFinancieros = toNumber(payload.porcentajeFinancieros, 2) / 100;
    const subtotalCostos = costoProductivo * (1 + porcentajeImprevistos) * (1 + porcentajeFinancieros);
    const porcentajeUtilidad = toNumber(payload.porcentajeUtilidad, proceso === 'digital' ? 22 : 28) / 100;
    const porcentajeVendedor = toNumber(payload.porcentajeVendedor, 3) / 100;
    const porcentajeDepartamento = toNumber(payload.porcentajeDepartamento, proceso === 'digital' ? 8 : 10) / 100;
    const porcentajeAgencia = toNumber(payload.porcentajeAgencia) / 100;
    const factorComercial = 1 + porcentajeUtilidad + porcentajeVendedor + porcentajeDepartamento + porcentajeAgencia;
    const subtotalAntesIVA = subtotalCostos * factorComercial;
    const ivaPorcentaje = toNumber(payload.ivaPorcentaje, 12) / 100;
    const iva = subtotalAntesIVA * ivaPorcentaje;
    const total = subtotalAntesIVA + iva;
    const precioUnitario = cantidad > 0 ? subtotalAntesIVA / cantidad : 0;
    const precioUnitarioConIVA = cantidad > 0 ? total / cantidad : 0;

    return {
        entradas: { proceso, cantidad, anchoEtiqueta, altoEtiqueta, anchoRollo, pasosPorLinea, filas, tintasEfectivas, cantidadCambios },
        metricas: { largoTotalPulgadas: roundCurrency(largoTotalPulgadas), piesLineales: roundCurrency(piesLineales), piesLinealesConMerma: roundCurrency(piesLinealesConMerma), msiBase: roundCurrency(msiBase), msiConMerma: roundCurrency(msiConMerma), areaM2: roundCurrency(areaM2), pesoKg: roundCurrency(pesoKg), minutosTiraje: roundCurrency(minutosTiraje) },
        desglose: { material: roundCurrency(costoMaterial), preprensa: roundCurrency(costoPreprensa), montaje: roundCurrency(costoMontaje), tintas: roundCurrency(costoTintas), tiraje: roundCurrency(costoTiraje), laminado: roundCurrency(costoLaminado), barniz: roundCurrency(costoBarniz), troquel: roundCurrency(costoTroquel), arte: roundCurrency(costoArte), cyrel: roundCurrency(costoCyrel), maquila: roundCurrency(costoMaquila), flete: roundCurrency(costoFlete), empaque: roundCurrency(costoEmpaque) },
        resumen: { costoProductivo: roundCurrency(costoProductivo), subtotalCostos: roundCurrency(subtotalCostos), subtotalAntesIVA: roundCurrency(subtotalAntesIVA), iva: roundCurrency(iva), total: roundCurrency(total), precioUnitario: roundCurrency(precioUnitario), precioUnitarioConIVA: roundCurrency(precioUnitarioConIVA) }
    };
}

function estimateMachineStageCost(machine, metrics) {
    if (!machine) return null;
    const setupMinutes = (machine.setupBaseMinutes || 0) + ((metrics.stationCount || 0) * (machine.setupPerStationMinutes || 0)) + (machine.setupExtraMinutes || 0);
    let runtimeUnits = metrics.productQuantity;
    const unit = normalizeText(machine.workUnit);
    if (unit.includes('pulgada')) runtimeUnits = metrics.linearInches;
    else if (unit.includes('trabajo')) runtimeUnits = 1;
    else if (unit.includes('msi')) runtimeUnits = metrics.msi;
    const runtimeMinutes = machine.productionSpeed > 0 ? runtimeUnits / machine.productionSpeed : 0;
    const totalHours = (setupMinutes + runtimeMinutes) / 60;
    const totalCost = totalHours * ((machine.hourlyMachineCost || 0) + (machine.hourlyOperatorCost || 0));

    return {
        machineId: machine.id,
        machineName: machine.machineName,
        category: machine.category,
        process: machine.process,
        subprocess: machine.subprocess,
        setupMinutes: roundCurrency(setupMinutes),
        runtimeMinutes: roundCurrency(runtimeMinutes),
        totalHours: roundCurrency(totalHours),
        totalCost: roundCurrency(totalCost),
        workUnit: machine.workUnit,
        productionSpeed: machine.productionSpeed,
        timeFormula: machine.timeFormula,
        costFormula: machine.costFormula
    };
}

function calculateFlexoPreview(payload, catalogs = loadFlexoCatalogs()) {
    const product = catalogs.products.find((item) => item.id === payload.productId) || null;
    const material = catalogs.materials.find((item) => item.id === payload.materialId) || null;
    const die = catalogs.dies.find((item) => item.id === payload.dieId) || null;
    const machineSelections = payload.machineSelections || {};
    const selectedPrintMachine = catalogs.machines.find((machine) => machine.id === machineSelections.impresion) || null;
    const digitalByMachine = isDigitalPrintingReference(
        `${selectedPrintMachine?.subprocess || ''} ${selectedPrintMachine?.process || ''} ${selectedPrintMachine?.type || ''}`
    );
    const digitalByProcess = isDigitalPrintingReference(payload.processType || payload.process || '');
    const digitalPlatesDisabled = digitalByMachine || digitalByProcess;
    const quantity = Math.max(0, toNumber(payload.quantityProducts, product?.quantityProducts || 0));
    const width = Math.max(0, toNumber(payload.widthInches, product?.width || 0));
    const length = Math.max(0, toNumber(payload.lengthInches, product?.length || 0));
    const stationCount = Math.max(0, toNumber(payload.stationCount, payload.tintCount || product?.tintCount || 0));
    const labelsPerPass = Math.max(1, toNumber(die?.rows, 1) * Math.max(1, toNumber(die?.repetitions, 1)));
    const linearInches = quantity > 0 && length > 0 ? (quantity / labelsPerPass) * length : 0;
    const linearFeet = linearInches / 12;
    const materialWidth = Math.max(width, toNumber(material?.widthInches, die?.materialWidth || width));
    const msi = (materialWidth * linearInches) / 1000;
    const materialCost = material?.costPerLinearMeterUsd ? (linearFeet * 0.3048) * material.costPerLinearMeterUsd : (material?.costPerUnitUsd ? linearFeet * material.costPerUnitUsd : 0);
    const categories = ['preprensa', 'impresion', 'troquelado', 'laminado', 'estampado', 'rebobinado', 'empaque'];
    const breakdown = categories.map((category) => {
        const selectedId = machineSelections[category];
        const autoMachine = catalogs.machineCategories[category]?.length === 1 ? catalogs.machineCategories[category][0] : null;
        const selectedMachine = catalogs.machines.find((machine) => machine.id === selectedId) || autoMachine || null;
        return estimateMachineStageCost(selectedMachine, { productQuantity: quantity, linearInches, stationCount, msi });
    }).filter(Boolean);
    const machineCostTotal = breakdown.reduce((sum, item) => sum + item.totalCost, 0);
    const subtotalCost = materialCost + machineCostTotal;
    const contingencyFactor = 1 + ((catalogs.globalCosts.commercialSettings.contingencyPercent || 0) / 100);
    const financialFactor = 1 + ((catalogs.globalCosts.commercialSettings.financialPercent || 0) / 100);
    const profitabilityFactor = 1 + ((catalogs.globalCosts.commercialSettings.profitabilityPercent || 0) / 100);
    const totalCost = subtotalCost * contingencyFactor * financialFactor * profitabilityFactor;
    const unitPrice = quantity > 0 ? totalCost / quantity : 0;

    return {
        selection: {
            productId: product?.id || '',
            materialId: material?.id || '',
            dieId: die?.id || '',
            quantity,
            width,
            length,
            stationCount,
            digitalPlatesDisabled
        },
        metrics: { labelsPerPass: roundCurrency(labelsPerPass), linearInches: roundCurrency(linearInches), linearFeet: roundCurrency(linearFeet), materialWidth: roundCurrency(materialWidth), msi: roundCurrency(msi) },
        costBreakdown: { material: roundCurrency(materialCost), machineStages: breakdown, subtotalCost: roundCurrency(subtotalCost), totalCost: roundCurrency(totalCost), unitPrice: roundCurrency(unitPrice) }
    };
}

function parseLegacyNumber(value) {
    if (value === '' || value === null || typeof value === 'undefined') {
        return null;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    const normalized = String(value)
        .replace(/\s+/g, '')
        .replace(/\.(?=\d{3}(\D|$))/g, '')
        .replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function pickFirstValue(...values) {
    for (const value of values) {
        if (value !== null && typeof value !== 'undefined' && String(value).trim() !== '') {
            return value;
        }
    }
    return '';
}

function buildSyntheticAddressFromPartner(partner) {
    const raw = partner?.raw_data?.socio || {};
    const line = pickFirstValue(raw.STREET, raw['Cliente | Direccion']);
    if (!line) {
        return [];
    }
    return [{
        id: 'raw-address',
        partner_code: partner.partner_code,
        address_name: partner.partner_name || 'Principal',
        address_type: 'B',
        country: pickFirstValue(raw.Country, raw['Country Name']),
        state_province: pickFirstValue(raw['STATE NAME'], raw.STATE),
        county: pickFirstValue(raw['CONTACTO CANTON']),
        district: '',
        address_line: line,
        zip_code: ''
    }];
}

function mapQuoteHeader(row) {
    const raw = row.raw_data || {};
    return {
        quote_code: row.quote_code,
        customer_code: pickFirstValue(row.customer_code, raw['ID CLIENTE']),
        customer_name: pickFirstValue(row.customer_name, raw['CLIENTE NOMBRE']),
        contact_name: pickFirstValue(row.contact_name, raw['CLIENTE | CONTACTO NOMBRE COMPLETO']),
        email: pickFirstValue(row.email, raw['CLIENTE | CONTACTO EMAIL']),
        salesperson_name: pickFirstValue(row.salesperson_name, raw.VENDEDOR, raw['VENDEDOR | USUARIO']),
        phone: pickFirstValue(row.phone, raw['CLIENTE | CONTACTO TELEFONO']),
        phone_secondary: pickFirstValue(raw['CLIENTE | CONTACTO TELEFONO SECUNDARIO']),
        status: pickFirstValue(row.status, raw['Estado Cotizacion']),
        created_on: row.created_on || raw['FECHA CREACION DATE'] || raw['FECHA CREACION'],
        due_on: row.due_on || raw['FECHA VENCIMIENTO'],
        exchange_sale: raw['TIPO CAMBIO VENTA'] || null,
        exchange_buy: raw['TIPO CAMBIO COMPRA'] || null,
        footer_dates: raw['PIE COTIZACION | DETALLE COTIZACION | FECHAS'] || '',
        footer_exchange: raw['PIE COTIZACION | DETALLE COTIZACION | TIPO CAMBIO'] || '',
        payment_terms: raw['CONDICION PAGO'] || '',
        delivery_time: raw['TIEMPO ENTREGA'] || '',
        raw_data: raw
    };
}

function mapCalculationLine(row) {
    const raw = row.raw_data || {};
    const subtotal1 = pickFirstValue(
        parseLegacyNumber(raw['GENERAL | 9 | TOTAL | COL EXPORTAR REPORTE VENTAS']),
        parseLegacyNumber(raw['GENERAL | 7 | SUBTOTAL CALC ANTES IV | COL']),
        parseLegacyNumber(raw['GENERAL | 7 | TOTAL | COL']),
        parseLegacyNumber(raw['GENERAL | 7 | TOTAL | DOL']),
        parseLegacyNumber(raw['PRECIO TOTAL AL FINALIZAR']),
        parseLegacyNumber(row.total_cost),
        (parseLegacyNumber(row.unit_price) !== null && parseLegacyNumber(row.quantity) !== null)
            ? parseLegacyNumber(row.unit_price) * parseLegacyNumber(row.quantity)
            : null
    );
    const lineOrderRaw = pickFirstValue(raw['CODEX_LINE_ORDER']);
    const lineOrder = Number.isFinite(Number(lineOrderRaw)) && Number(lineOrderRaw) > 0
        ? Number(lineOrderRaw)
        : null;

      return {
          line_code: pickFirstValue(row.line_code, raw['ID LINEA']),
          line_order: lineOrder,
          department: pickFirstValue(raw.DEPARTAMENTO, 'Flexografia'),
          job_name: pickFirstValue(raw['NOMBRE TRABAJO'], raw['Nombre Trabajo'], raw['TIPO TRABAJO | ORDEN REFERENCIA 1'], row.line_code),
          material_name: pickFirstValue(raw['GENERAL | MATERIAL'], raw.Material, row.material_code),
          finalized_for_order: Boolean(row.finalized_for_order ?? raw['CODEX_FINALIZED_FOR_ORDER']),
          status: pickFirstValue(raw['SOLICITUD ESTADO'], raw['ESTADO LINEA'], 'Cotizada'),
        subtotal_1: subtotal1,
        subtotal_2: null,
        subtotal_3: null,
        subtotal_4: null,
        hidden_flag: false,
        optional_flag: false,
        proof_flag: true,
        process_type: row.process_type || pickFirstValue(raw['Proceso Productivo']),
        product_code: row.product_code,
        machine_name: pickFirstValue(row.machine_name, raw['DIGITAL | MAQUINA'], raw['CONV | MAQUINA']),
        raw_data: raw
    };
}

function normalizeLineOrder(value, fallback = null) {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const SQL_LINE_ORDER_VALUE = `
    CASE
        WHEN COALESCE(raw_data->>'CODEX_LINE_ORDER', '') ~ '^[0-9]+$'
            THEN (raw_data->>'CODEX_LINE_ORDER')::integer
        ELSE NULL
    END
`;

async function getNextQuoteLineOrder(quoteCode) {
    const result = await pgQuery(
        `SELECT COALESCE(MAX(${SQL_LINE_ORDER_VALUE}), 0) AS max_order
           FROM flexo_calculations
          WHERE quote_code = $1`,
        [quoteCode]
    );
    return Number(result.rows[0]?.max_order || 0) + 1;
}

function mapFlexoCalculationDetail(row) {
    const raw = row.raw_data || {};
    const processType = pickFirstValue(row.process_type, raw['Proceso Productivo'], 'Convencional');
    const activePrefix = String(processType).toLowerCase().includes('digit') ? 'DIGITAL' : 'CONV';
    const quotedMachine = pickFirstValue(row.machine_name, raw['DIGITAL | MAQUINA'], raw['CONV | MAQUINA'], raw['MAQUINA IMPRESION']);
    const digitalPlatesDisabled = hasDigitalPrintingContext({ processType, machineName: quotedMachine, raw });
    const prepressCost = pickFirstValue(parseLegacyNumber(raw[`${activePrefix} | COSTO PREPRENSA`]));
    const cyrelCost = digitalPlatesDisabled ? 0 : parseLegacyNumber(raw['GENERAL | 4 | COSTO CYREL']);
    const subtotalBeforeTax = pickFirstValue(
        parseLegacyNumber(raw['GENERAL | 7 | SUBTOTAL CALC ANTES IV | DOL']),
        parseLegacyNumber(raw['GENERAL | 7 | TOTAL | DOL']),
        parseLegacyNumber(raw['GENERAL | 5 | SUBTOTAL']),
        parseLegacyNumber(row.total_cost)
    );
    const taxAmount = parseLegacyNumber(raw['GENERAL | 9 | Impuestos']);
    const finalTotal = pickFirstValue(
        parseLegacyNumber(raw['PRECIO TOTAL AL FINALIZAR']),
        subtotalBeforeTax !== '' && subtotalBeforeTax !== null && taxAmount !== null
            ? Number(subtotalBeforeTax) + Number(taxAmount)
            : null
    );

      return {
          calculationCode: row.calculation_code || '',
        quoteCode: pickFirstValue(row.quote_code, raw['ID COTIZACION']),
        lineCode: pickFirstValue(row.line_code, raw['ID LINEA']),
        customerCode: pickFirstValue(row.customer_code, raw['ID CLIENTE']),
        customerName: pickFirstValue(raw.CLIENTE),
        salespersonName: pickFirstValue(raw.VENDEDOR),
        jobName: pickFirstValue(raw['NOMBRE TRABAJO'], raw['TIPO TRABAJO | ORDEN REFERENCIA 1']),
        department: pickFirstValue(raw.DEPARTAMENTO, 'Flexografia'),
        processType,
          orderType: pickFirstValue(raw['TIPO ORDEN']),
          finalizedForOrder: Boolean(row.finalized_for_order ?? raw['CODEX_FINALIZED_FOR_ORDER']),
          lineStatus: pickFirstValue(raw['SOLICITUD ESTADO'], raw['ESTADO LINEA'], raw['FIN COTIZACION | ESTADO']),
        calculationType: pickFirstValue(raw['ESTADO LINEA | CALCULO'], raw['ESTADO LINEA | SEGUN CANTIDAD ELEMENTOS']),
        quantityProducts: pickFirstValue(
            parseLegacyNumber(raw['Cantidad Productos']),
            parseLegacyNumber(raw['CANTIDAD PRODUCTOS 1']),
            parseLegacyNumber(row.quantity)
        ),
        quantityTypes: parseLegacyNumber(raw['CANTIDAD TIPOS']),
        quantityChanges: parseLegacyNumber(raw['CANTIDAD CAMBIOS']),
        widthInches: parseLegacyNumber(raw['DIMENSIONES ETIQUETA | ANCHO']),
        lengthInches: parseLegacyNumber(raw['DIMENSIONES ETIQUETA | LARGO']),
        areaInches: parseLegacyNumber(raw['DIMENSIONES ETIQUETA | AREA']),
        areaM2: parseLegacyNumber(raw['DIMENSIONES ETIQUETA | AREA M2']),
        materialCode: pickFirstValue(raw['Material Convencional | Id Material'], raw['Material Digital | Id Material'], row.material_code),
        materialName: pickFirstValue(raw['GENERAL | MATERIAL'], raw['Material | Tipo Según Proceso Productivo'], raw['Material Convencional | Tipo con Medidas'], raw['Material Digital | Tipo con Medidas'], row.material_code),
        materialWidth: parseLegacyNumber(raw['GENERAL | MATERIAL | ANCHO']),
        materialM2: pickFirstValue(parseLegacyNumber(raw['Material | m2 Segun Proceso Productivo']), parseLegacyNumber(raw[`${activePrefix} | MATERIAL | AREA MTS`])),
        materialMsi: pickFirstValue(parseLegacyNumber(raw['Material | MSI Segun Proceso Productivo']), parseLegacyNumber(raw[`${activePrefix} | MATERIAL | CANTIDAD MSI INCLUYE MACULA`]), parseLegacyNumber(raw[`${activePrefix} | MATERIAL | CANTIDAD MSI`])),
        materialFeet: pickFirstValue(parseLegacyNumber(raw['Material | Pies Segun Proceso Productivo']), parseLegacyNumber(raw[`${activePrefix} | MATERIAL | CANTIDAD PIES LINEALES INCLUYE MACULA`]), parseLegacyNumber(raw[`${activePrefix} | MATERIAL | CANTIDAD PIES LINEALES`])),
        materialFeetWaste: pickFirstValue(parseLegacyNumber(raw['Material | Pies Macula Segun Proceso Productivo']), parseLegacyNumber(raw[`${activePrefix} | MATERIAL | CANTIDAD PIES MACULA | CALCULO`])),
        dieCode: pickFirstValue(raw['GENERAL | TROQUEL | ID'], raw[`${activePrefix} | TROQUEL | ID`], row.die_code),
        dieTeeth: pickFirstValue(parseLegacyNumber(raw['GENERAL | TROQUEL | DIENTES']), parseLegacyNumber(raw[`${activePrefix} | TROQUEL | DIENTES`])),
        dieRows: parseLegacyNumber(raw[`${activePrefix} | TROQUEL | CANTIDAD FILAS`]),
        dieRepeats: pickFirstValue(parseLegacyNumber(raw['CONV | TROQUEL | REPETICIONES']), parseLegacyNumber(raw['DIGITAL | TROQUEL | REPETICIONES'])),
        tintCount: pickFirstValue(parseLegacyNumber(raw['CANTIDAD TINTAS']), parseLegacyNumber(raw['DIGITAL | CANTIDAD TINTAS'])),
        pantoneCount: parseLegacyNumber(raw['CANTIDAD PANTONES']),
        labelsPerRoll: parseLegacyNumber(raw['CANTIDAD ETIQUETAS X ROLLO']),
        applicationType: pickFirstValue(raw['TIPO ETIQUETADO']),
        outputType: pickFirstValue(raw['TIPO SALIDA']),
        coreWidth: parseLegacyNumber(raw['ANCHO CORE']),
        coreDiameter: pickFirstValue(raw['DIAMETRO CORE']),
        cmyk: raw['GENERAL | CMYK'] === true || String(raw['CMYK'] || '').trim().toLowerCase() === 'si',
        quotedMachine,
        subtotalCost: pickFirstValue(parseLegacyNumber(raw['GENERAL | 1 | SUBTOTAL COSTOS | DOL | MOSTRAR']), parseLegacyNumber(raw['GENERAL | 1 | Costo Productivo']), parseLegacyNumber(raw[`${activePrefix} | 0 | SUBTOTAL COSTOS`])),
        subtotalFinancial: parseLegacyNumber(raw['GENERAL | 2 | SUBTOTAL COSTOS']),
        subtotalPerformance: pickFirstValue(parseLegacyNumber(raw['GENERAL | 3 | SUBTOTAL MAS RENDIMIENTO']), parseLegacyNumber(raw['GENERAL | 2 | Precio Venta'])),
        cyrelCost,
        subtotalBeforeTax,
        taxAmount,
        finalTotal,
        unitPrice: pickFirstValue(parseLegacyNumber(raw['GENERAL | 9 | UNITARIO | DOL']), parseLegacyNumber(row.unit_price)),
        thousandPrice: parseLegacyNumber(raw['GENERAL | 9 | MILLAR | DOL']),
        totalColones: pickFirstValue(parseLegacyNumber(raw['GENERAL | 7 | SUBTOTAL CALC ANTES IV | COL']), parseLegacyNumber(raw['GENERAL | 7 | TOTAL | COL'])),
        exchangeRate: pickFirstValue(parseLegacyNumber(raw['TIPO CAMBIO']), parseLegacyNumber(raw['TIPO CAMBIO VENTA']), parseLegacyNumber(raw['TIPO CAMBIO COMPRA'])),
        minimumCost: parseLegacyNumber(raw['COSTOS | COSTO MINIMO']),
        contingencyPercent: parseLegacyNumber(raw['GENERAL | 1 | PORCENTAJE IMPREVISTOS | UTILIZAR']),
        financialPercent: parseLegacyNumber(raw['GENERAL | 1 | PORCENTAJE COSTOS FINANCIEROS | UTILIZAR']),
        extraPercent: parseLegacyNumber(raw['Porcentaje Adicional']),
        taxPercent: parseLegacyNumber(raw['GENERAL | 8 | PORCENTAJE IVA']),
        components: {
            material: pickFirstValue(parseLegacyNumber(raw[`${activePrefix} | COSTO MATERIAL`]), parseLegacyNumber(raw['Material | Costo Material'])),
            inks: pickFirstValue(parseLegacyNumber(raw[`${activePrefix} | COSTO TINTAS`]), parseLegacyNumber(raw['DIGITAL | COSTO TINTAS CMYK'])),
            print: pickFirstValue(parseLegacyNumber(raw[`${activePrefix} | COSTO IMPRESION`])),
            prepress: prepressCost,
            finishes: pickFirstValue(parseLegacyNumber(raw[`${activePrefix} | COSTO ACABADOS`])),
            packaging: pickFirstValue(parseLegacyNumber(raw[`${activePrefix} | COSTO EMPAQUE`])),
            runCost: pickFirstValue(parseLegacyNumber(raw[`${activePrefix} | COSTO TIRAJE`]))
        },
        validations: {
            solicitud: pickFirstValue(raw['ANALISIS CAMPOS SOLICITUD']),
            finalizar: pickFirstValue(raw['ANALISIS CAMPOS FINALIZAR']),
            crearOrden: pickFirstValue(raw['ANALISIS CAMPOS CREAR ORDEN'])
        },
        notes: {
            quoteSummary: pickFirstValue(raw['Resumen Cotización'], raw['Resumen Cotizacion']),
            printSummary: pickFirstValue(raw['INFORMACION IMPRESION COTIZACION | MOSTRAR'], raw['INFORMACION IMPRESION COTIZACION | CALCULO']),
            observations: pickFirstValue(raw['OBSERVACIONES SOLICITUD']),
            creationStatus: pickFirstValue(raw['CREACION ESTADO'])
        },
        uiState: raw['CODEX_UI_STATE'] || null,
        digitalPlatesDisabled,
        raw_data: raw
    };
}

function normalizeProformaStatus(value) {
    return String(value || '').trim().toLowerCase() === 'closed' ? 'closed' : 'open';
}

function normalizeProformaPriceDisplayMode(value) {
    const normalized = String(value || '').trim();
    return ['unit', 'thousand', 'both', 'product_totals', 'global_totals'].includes(normalized) ? normalized : 'both';
}

function normalizeProformaHeaderColor(value, fallback = '#203852') {
    const normalized = String(value || '').trim();
    return /^#([0-9a-fA-F]{6})$/.test(normalized) ? normalized : fallback;
}

function getProformaConfigSnapshot(config = {}) {
    const general = config.general || {};
    const currencies = normalizeProformaCurrencyList(general.proformaCurrenciesJson);
    const defaultCurrency = String(general.proformaDefaultCurrency || currencies[0]?.code || 'CRC').trim().toUpperCase();
    const selectedCurrency = currencies.find((item) => item.code === defaultCurrency) || currencies[0] || { code: 'CRC', label: 'Colones', symbol: '₡', exchangeRate: 1 };
    return {
        logoUrl: String(general.proformaLogoUrl || '').trim(),
        companyName: String(general.proformaCompanyName || '').trim(),
        slogan: String(general.proformaSlogan || '').trim(),
        headerColor: normalizeProformaHeaderColor(general.proformaHeaderColor, DEFAULT_GENERAL_CONFIG.general.proformaHeaderColor),
        companyNameColor: normalizeProformaHeaderColor(general.proformaCompanyNameColor, DEFAULT_GENERAL_CONFIG.general.proformaCompanyNameColor),
        fontFamilySource: String(general.proformaCompanyFontFamily || 'Cormorant Garamond').trim() || 'Cormorant Garamond',
        fontFamily: String(
            String(general.proformaCompanyFontFamily || 'Cormorant Garamond').trim() === '__custom__'
                ? (general.proformaCompanyFontLabel || 'Fuente Proforma')
                : (general.proformaCompanyFontFamily || 'Cormorant Garamond')
        ).trim(),
        fontUrl: String(general.proformaCompanyFontUrl || '').trim(),
        showCompanyName: String(general.proformaShowCompanyName || 'true').trim().toLowerCase() !== 'false',
        logoWidth: Number(general.proformaLogoWidth || DEFAULT_GENERAL_CONFIG.general.proformaLogoWidth) || DEFAULT_GENERAL_CONFIG.general.proformaLogoWidth,
        logoHeight: Number(general.proformaLogoHeight || DEFAULT_GENERAL_CONFIG.general.proformaLogoHeight) || DEFAULT_GENERAL_CONFIG.general.proformaLogoHeight,
        logoMarginTop: Number(general.proformaLogoMarginTop || 0) || 0,
        logoMarginLeft: Number(general.proformaLogoMarginLeft || 0) || 0,
        phone: String(general.proformaPhone || '').trim(),
        website: String(general.proformaWebsite || '').trim(),
        email: String(general.proformaEmail || '').trim(),
        currencies,
        defaultCurrency: defaultCurrency || selectedCurrency.code,
        defaultCurrencyMeta: selectedCurrency,
        defaultValidity: String(general.proformaDefaultValidity || '').trim(),
        intro: String(general.proformaIntro || '').trim(),
        introStyle: {
            fontFamily: String(general.proformaIntroFontFamily || 'inherit').trim() || 'inherit',
            fontSize: Number(general.proformaIntroFontSize || 15) || 15,
            color: normalizeProformaHeaderColor(general.proformaIntroColor, '#2f3c46')
        },
        termsConditions: String(general.proformaTermsConditions || '').trim(),
        paymentTerms: String(general.proformaPaymentTerms || '').trim(),
        deliveryTime: String(general.proformaDeliveryTime || '').trim(),
        technicalSpecs: String(general.proformaTechnicalSpecs || '').trim(),
        qualityPolicies: String(general.proformaQualityPolicies || '').trim(),
        priceDisplayMode: normalizeProformaPriceDisplayMode(general.proformaPriceDisplayMode),
        sellerSignatureEnabled: String(general.proformaSellerSignatureEnabled || 'true').trim().toLowerCase() !== 'false'
    };
}

function buildProformaProductSummary(line = {}, currency = {}, displayMode = 'both') {
    const raw = line.raw_data || {};
    const quantity = parseLegacyNumber(raw['CANTIDAD SOLICITADA']) ?? parseLegacyNumber(raw.CANTIDAD) ?? parseLegacyNumber(raw['Cantidad']) ?? null;
    const width = parseLegacyNumber(raw['DIMENSIONES ETIQUETA | ANCHO']) ?? null;
    const length = parseLegacyNumber(raw['DIMENSIONES ETIQUETA | LARGO']) ?? null;
    const unitPriceUsd = pickFirstValue(
        parseLegacyNumber(raw['PRECIO UNITARIO']),
        parseLegacyNumber(raw['GENERAL | 9 | PRECIO UNITARIO']),
        parseLegacyNumber(raw['PRECIO UNITARIO FINAL']),
        quantity && Number(line.subtotal_1) ? Number(line.subtotal_1) / quantity : null
    );
    const thousandPriceUsd = unitPriceUsd != null ? unitPriceUsd * 1000 : null;
    const totalUsd = Number(line.subtotal_1 || 0) || 0;
    const exchangeRate = Number(currency?.exchangeRate || 1) || 1;
    return {
        lineCode: line.line_code,
        name: line.job_name || 'Producto',
        material: line.material_name || '',
        processType: line.process_type || '',
        dimensionsText: width && length ? `${width}" x ${length}"` : '',
        quantity,
        unitPrice: unitPriceUsd != null ? roundCurrency(unitPriceUsd * exchangeRate) : null,
        thousandPrice: thousandPriceUsd != null ? roundCurrency(thousandPriceUsd * exchangeRate) : null,
        totalPrice: roundCurrency(totalUsd * exchangeRate),
        currencyCode: currency?.code || 'CRC',
        currencySymbol: currency?.symbol || '',
        displayMode
    };
}

async function closeQuoteProforma(quoteCode, reason = 'manual', client = null) {
    if (!quoteCode) return null;
    const executor = client || { query: pgQuery };
    const existing = await executor.query(
        `SELECT id, quote_code, status, issue_date_fixed, closed_at, closed_reason, raw_data
           FROM quote_proformas
          WHERE quote_code = $1
          LIMIT 1`,
        [quoteCode]
    );
    if (existing.rows.length && normalizeProformaStatus(existing.rows[0].status) === 'closed') {
        return existing.rows[0];
    }
    const result = await executor.query(
        `INSERT INTO quote_proformas (quote_code, status, issue_date_fixed, closed_at, closed_reason, raw_data)
         VALUES ($1, 'closed', NOW(), NOW(), $2, '{}'::jsonb)
         ON CONFLICT (quote_code)
         DO UPDATE SET
            status = 'closed',
            issue_date_fixed = COALESCE(quote_proformas.issue_date_fixed, NOW()),
            closed_at = NOW(),
            closed_reason = EXCLUDED.closed_reason,
            updated_at = NOW()
         RETURNING id, quote_code, status, issue_date_fixed, closed_at, closed_reason, raw_data`,
        [quoteCode, String(reason || 'manual').trim() || 'manual']
    );
    return result.rows[0] || null;
}

async function buildQuoteProformaPayload(quoteCode, client = null) {
    const executor = client || { query: pgQuery };
    const config = await loadGeneralConfig();
    const configSnapshot = getProformaConfigSnapshot(config);
    const quoteContext = client
        ? await getQuoteLineContext(quoteCode, '__header_only__', client)
        : await getQuoteLineContext(quoteCode, '__header_only__');
    if (!quoteContext?.quote) {
        throw new Error('Cotización no encontrada.');
    }
    const linesResult = await executor.query(
        `SELECT calculation_code, quote_code, line_code, product_code, customer_code, process_type, machine_name, die_code, material_code,
                quantity, subtotal_cost, total_cost, unit_price, raw_data, created_at
           FROM (
                SELECT DISTINCT ON (line_code)
                       calculation_code, quote_code, line_code, product_code, customer_code, process_type, machine_name, die_code, material_code,
                       quantity, subtotal_cost, total_cost, unit_price, raw_data, created_at
                  FROM flexo_calculations
                 WHERE quote_code = $1
                 ORDER BY line_code NULLS LAST, created_at DESC NULLS LAST, calculation_code DESC NULLS LAST
           ) latest_lines
          ORDER BY line_code NULLS LAST`,
        [quoteCode]
    );
    const lines = linesResult.rows.map(mapCalculationLine);
    const proformaResult = await executor.query(
        `SELECT id, quote_code, status, issue_date_fixed, closed_at, closed_reason, raw_data
           FROM quote_proformas
          WHERE quote_code = $1
          LIMIT 1`,
        [quoteCode]
    );
    const existing = proformaResult.rows[0] || null;
    const rawData = existing?.raw_data || {};
    const selectedCurrencyCode = String(rawData.currencyCode || configSnapshot.defaultCurrency).trim().toUpperCase();
    const currency = configSnapshot.currencies.find((item) => item.code === selectedCurrencyCode) || configSnapshot.defaultCurrencyMeta;
    const salespersonName = pickFirstValue(rawData.salespersonName, quoteContext.quote.salesperson_name);
    let sellerSignatureUrl = '';
    if (configSnapshot.sellerSignatureEnabled && salespersonName) {
        const signatureResult = await executor.query(
            `SELECT signature_url
               FROM admin_users
              WHERE LOWER(TRIM(full_name)) = LOWER(TRIM($1))
                 OR LOWER(TRIM(username)) = LOWER(TRIM($1))
              ORDER BY id
              LIMIT 1`,
            [salespersonName]
        );
        sellerSignatureUrl = sanitizeAdminUserText(signatureResult.rows[0]?.signature_url);
    }
    const issueDate = existing?.issue_date_fixed ? new Date(existing.issue_date_fixed) : new Date();
    const products = lines.map((line) => buildProformaProductSummary(line, currency, rawData.priceDisplayMode || configSnapshot.priceDisplayMode));
    const grandTotal = roundCurrency(products.reduce((acc, item) => acc + Number(item.totalPrice || 0), 0));
    return {
        quoteCode,
        status: normalizeProformaStatus(existing?.status),
        issueDate: issueDate.toISOString(),
        closedAt: existing?.closed_at || null,
        closedReason: sanitizeAdminUserText(existing?.closed_reason),
        company: {
            logoUrl: configSnapshot.logoUrl,
            name: rawData.companyName || configSnapshot.companyName,
            slogan: rawData.companySlogan || configSnapshot.slogan,
            headerColor: configSnapshot.headerColor,
            nameColor: configSnapshot.companyNameColor,
            fontFamilySource: configSnapshot.fontFamilySource,
            fontFamily: configSnapshot.fontFamily,
            fontUrl: configSnapshot.fontUrl,
            showCompanyName: configSnapshot.showCompanyName,
            logoWidth: configSnapshot.logoWidth,
            logoHeight: configSnapshot.logoHeight,
            logoMarginTop: configSnapshot.logoMarginTop,
            logoMarginLeft: configSnapshot.logoMarginLeft,
            phone: rawData.companyPhone || configSnapshot.phone,
            website: rawData.companyWebsite || configSnapshot.website,
            email: rawData.companyEmail || configSnapshot.email
        },
        client: {
            company: pickFirstValue(rawData.clientCompany, quoteContext.quote.customer_name),
            contactName: pickFirstValue(rawData.clientContactName, quoteContext.quote.contact_name),
            phone: pickFirstValue(rawData.clientPhone, quoteContext.quote.phone),
            email: pickFirstValue(rawData.clientEmail, quoteContext.quote.email)
        },
        seller: {
            name: salespersonName,
            role: 'Ejecutivo de Ventas',
            signatureUrl: sellerSignatureUrl
        },
        currency: {
            code: currency.code,
            label: currency.label,
            symbol: currency.symbol,
            exchangeRate: Number(rawData.exchangeRate || currency.exchangeRate || 1) || 1
        },
        currencies: configSnapshot.currencies,
        validity: pickFirstValue(rawData.validity, configSnapshot.defaultValidity),
        priceDisplayMode: normalizeProformaPriceDisplayMode(rawData.priceDisplayMode || configSnapshot.priceDisplayMode),
        intro: pickFirstValue(rawData.intro, configSnapshot.intro),
        introStyle: rawData.introStyle || configSnapshot.introStyle,
        termsConditions: pickFirstValue(rawData.termsConditions, configSnapshot.termsConditions),
        paymentTerms: pickFirstValue(rawData.paymentTerms, configSnapshot.paymentTerms),
        deliveryTime: pickFirstValue(rawData.deliveryTime, configSnapshot.deliveryTime),
        technicalSpecs: pickFirstValue(rawData.technicalSpecs, configSnapshot.technicalSpecs),
        qualityPolicies: pickFirstValue(rawData.qualityPolicies, configSnapshot.qualityPolicies),
        sellerSignatureEnabled: configSnapshot.sellerSignatureEnabled,
        priceDisplayModeOptions: [
            { value: 'unit', label: 'Mostrar precio unitario' },
            { value: 'thousand', label: 'Mostrar precio por millar' },
            { value: 'both', label: 'Mostrar ambos' },
            { value: 'product_totals', label: 'Mostrar únicamente totales por producto' },
            { value: 'global_totals', label: 'Mostrar totales globales' }
        ],
        products,
        totals: {
            grandTotal,
            currencyCode: currency.code,
            currencySymbol: currency.symbol
        },
        footer: {
            disclaimer: 'Cotización proforma no constituye una factura fiscal',
            generatedOn: issueDate.toISOString()
        }
    };
}

async function getActiveTenantId(client = null) {
    const executor = client || { query: pgQuery };
    const result = await executor.query(`SELECT id FROM tenant ORDER BY creado_en ASC NULLS LAST, id ASC LIMIT 1`);
    return result.rows[0]?.id || null;
}

async function generateNextQuoteCode(client = null) {
    const executor = client || { query: pgQuery };
    const result = await executor.query(
        `SELECT quote_code
           FROM quotes
          WHERE quote_code ~ '^C-[0-9]+$'
          ORDER BY CAST(REPLACE(quote_code, 'C-', '') AS INTEGER) DESC
          LIMIT 1`
    );
    const current = Number(String(result.rows[0]?.quote_code || 'C-0').replace('C-', '')) || 0;
    return `C-${String(current + 1).padStart(6, '0')}`;
}

async function generateNextLineCode(client = null) {
    const executor = client || { query: pgQuery };
    const result = await executor.query(
        `SELECT line_code
           FROM flexo_calculations
          WHERE line_code ~ '^LC[0-9]+$'
          ORDER BY CAST(REPLACE(line_code, 'LC', '') AS INTEGER) DESC
          LIMIT 1`
    );
    const current = Number(String(result.rows[0]?.line_code || 'LC0').replace('LC', '')) || 0;
    return `LC${current + 1}`;
}

async function generateNextCalculationCode(client = null) {
    const executor = client || { query: pgQuery };
    const result = await executor.query(
        `SELECT calculation_code
           FROM flexo_calculations
          WHERE calculation_code ~ '^CF-[0-9]+$'
          ORDER BY CAST(REPLACE(calculation_code, 'CF-', '') AS INTEGER) DESC
          LIMIT 1`
    );
    const current = Number(String(result.rows[0]?.calculation_code || 'CF-0').replace('CF-', '')) || 0;
    return `CF-${String(current + 1).padStart(6, '0')}`;
}

async function generateNextOrderCode(client = null) {
    const executor = client || { query: pgQuery };
    const result = await executor.query(
        `SELECT order_code
           FROM flexo_orders
          WHERE order_code ~ '^OP-[0-9]+$'
          ORDER BY CAST(REPLACE(order_code, 'OP-', '') AS INTEGER) DESC
          LIMIT 1`
    );
    const current = Number(String(result.rows[0]?.order_code || 'OP-0').replace('OP-', '')) || 0;
    return `OP-${String(current + 1).padStart(6, '0')}`;
}

async function ensureProductionSchema() {
    await pgQuery(`
        CREATE TABLE IF NOT EXISTS flexo_orders (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_code TEXT UNIQUE,
            quote_code TEXT,
            line_code TEXT,
            product_code TEXT,
            machine_name TEXT,
            material_code TEXT,
            die_code TEXT,
            ordered_quantity NUMERIC(14,4),
            delivered_on DATE,
            raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
}

async function ensureAttachmentsSchema() {
    await pgQuery(`
        CREATE TABLE IF NOT EXISTS quote_line_attachments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            quote_code TEXT NOT NULL,
            line_code TEXT NOT NULL,
            file_name TEXT NOT NULL,
            mime_type TEXT,
            file_ext TEXT,
            content_base64 TEXT NOT NULL,
            notes TEXT,
            uploaded_by TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await pgQuery(`CREATE INDEX IF NOT EXISTS idx_quote_line_attachments_line ON quote_line_attachments(quote_code, line_code)`);
}

async function ensureNotificationsSchema() {
    await pgQuery(`
        CREATE TABLE IF NOT EXISTS quote_line_notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            quote_code TEXT NOT NULL,
            line_code TEXT NOT NULL,
            seller_name TEXT,
            customer_name TEXT,
            job_name TEXT,
            issue_text TEXT NOT NULL,
            target_user TEXT,
            created_by TEXT,
            snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await pgQuery(`CREATE INDEX IF NOT EXISTS idx_quote_line_notifications_line ON quote_line_notifications(quote_code, line_code, created_at DESC)`);
}

function normalizePlanningKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .trim();
}

function isCompletedOrderRecord(row = {}) {
    const raw = row.raw_data || {};
    const statuses = [
        row.status,
        row.delivered_on ? 'entregada' : '',
        raw.status,
        raw.order_status,
        raw['Estado Cotizacion'],
        raw['ESTADO LINEA'],
        raw['SOLICITUD ESTADO'],
        raw.line_summary?.status,
        raw.line_summary?.line_status
    ].filter(Boolean).map((value) => String(value).trim().toLowerCase());

    return row.delivered_on || statuses.some((value) => [
        'entregada',
        'entregado',
        'completada',
        'completado',
        'cerrada',
        'cerrado',
        'cancelada',
        'cancelado'
    ].includes(value));
}

function inferPlanningOrderSnapshot(orderRow = {}) {
    const raw = orderRow.raw_data || {};
    const lineSummary = raw.line_summary || {};
    const lineSnapshot = raw.line_snapshot || {};
    const lineRaw = lineSnapshot.raw_data || {};

    return {
        orderCode: orderRow.order_code,
        quoteCode: orderRow.quote_code,
        lineCode: orderRow.line_code,
        customerName: pickFirstValue(raw.customer_name, lineSummary.customer_name),
        jobName: pickFirstValue(lineSummary.job_name, lineSnapshot.jobName, lineRaw['NOMBRE TRABAJO']),
        productName: pickFirstValue(lineSummary.product_name, lineSnapshot.productName),
        processType: pickFirstValue(lineSummary.process_type, lineSnapshot.processType),
        machineName: pickFirstValue(orderRow.machine_name, lineSummary.machine_name, lineSnapshot.quotedMachine),
        materialName: pickFirstValue(orderRow.material_code, lineSummary.material_name, lineSnapshot.materialName),
        dieCode: pickFirstValue(orderRow.die_code, lineSummary.die_code, lineSnapshot.dieCode),
        orderedQuantity: Number(orderRow.ordered_quantity || 0),
        raw
    };
}

function isTruthyProcessFlag(value) {
    const normalized = String(value ?? '').trim().toLowerCase();
    return value === true || ['si', 'sí', 'true', '1', 'x', 'activo'].includes(normalized);
}

function inferRouteProcessKeys(orderRow = {}) {
    const snapshot = inferPlanningOrderSnapshot(orderRow);
    const raw = snapshot.raw?.line_snapshot?.raw_data || snapshot.raw || {};
    const processKeys = ['preprensa', 'impresion'];

    if (isTruthyProcessFlag(raw['ACABADOS | BARNIZ']) || isTruthyProcessFlag(raw['BARNIZ']) || isTruthyProcessFlag(raw['BARNIZ UV'])) {
        processKeys.push('barnizado');
    }
    if (isTruthyProcessFlag(raw['ACABADOS | LAMINADO']) || isTruthyProcessFlag(raw['LAMINADO'])) {
        processKeys.push('laminado');
    }
    if (isTruthyProcessFlag(raw['ACABADOS | FOIL']) || isTruthyProcessFlag(raw['FOIL']) || isTruthyProcessFlag(raw['ESTAMPADO'])) {
        processKeys.push('estampado');
    }
    if (isTruthyProcessFlag(raw['ACABADOS | EMBOSADO']) || isTruthyProcessFlag(raw['EMBOSADO'])) {
        processKeys.push('embosado');
    }
    if (snapshot.dieCode || raw['GENERAL | TROQUEL | ID'] || isTruthyProcessFlag(raw['TROQUELADO'])) {
        processKeys.push('troquelado');
    }
    processKeys.push('rebobinado', 'empaque');

    return Array.from(new Set(processKeys));
}

async function listLiveOrders() {
    const result = await pgQuery(`
        SELECT order_code, quote_code, line_code, product_code, machine_name, material_code, die_code,
               ordered_quantity, delivered_on, raw_data, created_at
        FROM flexo_orders
        ORDER BY created_at DESC
    `);
    return result.rows.filter((row) => !isCompletedOrderRecord(row) && isOrderVisibleInGantt(row));
}

async function loadPlanningReferenceMaps(client = null) {
    const executor = client || { query: pgQuery };
    const [processResult, profileResult] = await Promise.all([
        executor.query(`SELECT * FROM production_process_definitions WHERE is_active = TRUE ORDER BY sequence_order`),
        executor.query(`SELECT * FROM production_machine_profiles WHERE is_active = TRUE ORDER BY process_name, machine_name`)
    ]);

    const processMap = new Map(processResult.rows.map((row) => [row.process_key, row]));
    const profileMap = new Map();
    profileResult.rows.forEach((row) => {
        if (!profileMap.has(row.process_key)) profileMap.set(row.process_key, []);
        profileMap.get(row.process_key).push(row);
    });

    return { processMap, profileMap };
}

function selectMachineProfileForPlanning(processKey, snapshot, profileMap = new Map()) {
    const profiles = profileMap.get(processKey) || [];
    if (!profiles.length) return null;
    const sourceMachineKey = normalizePlanningKey(snapshot?.machineName || '');
    if (sourceMachineKey) {
        const exact = profiles.find((row) => normalizePlanningKey(row.machine_name) === sourceMachineKey);
        if (exact) return exact;
    }
    return profiles[0] || null;
}

function buildPlanningSnapshot(rawData = {}, processMap = new Map(), profileMap = new Map()) {
    const pseudoOrder = {
        machine_name: rawData?.line_snapshot?.quotedMachine || '',
        material_code: rawData?.line_snapshot?.materialCode || '',
        die_code: rawData?.line_snapshot?.dieCode || '',
        ordered_quantity: rawData?.totals?.quantity || 0,
        raw_data: rawData
    };
    const snapshot = inferPlanningOrderSnapshot(pseudoOrder);
    const processKeys = inferRouteProcessKeys(pseudoOrder);
    const baseFeet = Number(
        snapshot.raw?.line_snapshot?.materialFeet
        || snapshot.raw?.line_summary?.material_feet
        || snapshot.raw?.line_snapshot?.raw_data?.['GENERAL | SUSTRATO | CONSUMO PIES']
        || 0
    ) || 0;
    const tintCount = Number(
        snapshot.raw?.line_snapshot?.tintCount
        || snapshot.raw?.line_snapshot?.pantoneCount
        || 0
    ) || 0;

    const processes = processKeys.map((processKey, index) => {
        const process = processMap.get(processKey);
        const machineProfile = selectMachineProfileForPlanning(processKey, snapshot, profileMap);
        const speed = Number(machineProfile?.nominal_speed_fpm || 0);
        const setupBaseMinutes = Number(machineProfile?.setup_minutes || 0);
        const setupPerStationMinutes = Number(machineProfile?.setup_per_station_minutes || 0);
        const setupMinutes = setupBaseMinutes + ((processKey === 'impresion' ? tintCount : 0) * setupPerStationMinutes);
        const runMinutes = speed > 0 && baseFeet > 0 ? baseFeet / speed : 0;
        const durationHours = Number((((setupMinutes + runMinutes) / 60) || 0.25).toFixed(4));

        return {
            processKey,
            processName: process?.process_name || processKey,
            sequenceOrder: index + 1,
            machineProfileId: machineProfile?.id || null,
            machineName: machineProfile?.machine_name || snapshot.machineName || '',
            tintCount,
            baseFeet,
            speedFpm: speed,
            setupMinutes: Number(setupMinutes.toFixed(4)),
            runMinutes: Number(runMinutes.toFixed(4)),
            durationHours,
            source: machineProfile ? 'profile-estimate' : 'fallback-estimate'
        };
    });

    return {
        generatedAt: new Date().toISOString(),
        promisedDeliveryDate: rawData?.planning_control?.promisedDeliveryDate || rawData?.quote_snapshot?.due_on || null,
        processType: snapshot.processType || rawData?.line_summary?.process_type || '',
        sourceMachineName: snapshot.machineName || '',
        baseFeet,
        tintCount,
        processes
    };
}

async function enrichOrderRawDataWithPlanningSnapshot(rawData = {}, client = null) {
    const { processMap, profileMap } = await loadPlanningReferenceMaps(client);
    return {
        ...rawData,
        planning_snapshot: buildPlanningSnapshot(rawData, processMap, profileMap)
    };
}

async function ensurePlanningRoutesForLiveOrders() {
    const [orders, references] = await Promise.all([
        listLiveOrders(),
        loadPlanningReferenceMaps()
    ]);
    for (const order of orders) {
        await ensurePlanningRoutesForOrder(order, references);
    }
}

async function ensurePlanningRoutesForOrder(order, references = null, options = {}) {
    if (!order?.order_code) return;
    const resolvedReferences = references || await loadPlanningReferenceMaps();
    const { processMap, profileMap } = resolvedReferences;
    const replaceExisting = options.replaceExisting === true;
    const existingResult = await pgQuery(
        `SELECT id::text, sequence_order FROM production_order_routes WHERE order_code = $1 ORDER BY sequence_order`,
        [order.order_code]
    );
    if (existingResult.rows.length && !replaceExisting) return;
    if (existingResult.rows.length && replaceExisting) {
        await pgQuery(`DELETE FROM production_order_routes WHERE order_code = $1`, [order.order_code]);
    }

    const snapshot = inferPlanningOrderSnapshot(order);
    const freshPlanningSnapshot = buildPlanningSnapshot(order.raw_data || {}, processMap, profileMap);
    const storedPlanningSnapshot = order.raw_data?.planning_snapshot || order.raw_data?.planningSnapshot || null;
    const plannedProcesses = Array.isArray(freshPlanningSnapshot?.processes) && freshPlanningSnapshot.processes.length
        ? freshPlanningSnapshot.processes
        : Array.isArray(storedPlanningSnapshot?.processes) && storedPlanningSnapshot.processes.length
            ? storedPlanningSnapshot.processes
            : [];

    let startHour = 0;
    let previousRouteId = null;

    for (const plannedProcess of plannedProcesses) {
        const processKey = plannedProcess.processKey;
        const process = processMap.get(processKey);
        if (!process) continue;

        const machineProfile = plannedProcess.machineProfileId
            ? (profileMap.get(processKey) || []).find((row) => String(row.id) === String(plannedProcess.machineProfileId)) || selectMachineProfileForPlanning(processKey, snapshot, profileMap)
            : selectMachineProfileForPlanning(processKey, snapshot, profileMap);
        const durationHours = Number(plannedProcess.durationHours || 0) > 0
            ? Number(plannedProcess.durationHours)
            : 0.25;

        const insertResult = await pgQuery(`
            INSERT INTO production_order_routes (
                order_code, quote_code, line_code, sequence_order,
                process_key, process_name, machine_profile_id,
                start_turn_hour, duration_hours, dependency_route_id,
                route_status, source_mode, route_payload
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDIENTE','auto',$11::jsonb)
            RETURNING id
        `, [
            order.order_code,
            order.quote_code,
            order.line_code,
            Number(plannedProcess.sequenceOrder || 1),
            process.process_key,
            process.process_name,
            machineProfile?.id || null,
            startHour,
            durationHours,
            previousRouteId,
            JSON.stringify({
                inferred: true,
                planningSnapshotUsed: Boolean(freshPlanningSnapshot?.processes?.length || storedPlanningSnapshot?.processes?.length),
                baseFeet: Number(plannedProcess.baseFeet || freshPlanningSnapshot?.baseFeet || storedPlanningSnapshot?.baseFeet || 0),
                tintCount: Number(plannedProcess.tintCount || freshPlanningSnapshot?.tintCount || storedPlanningSnapshot?.tintCount || 0),
                sourceMachineName: plannedProcess.machineName || snapshot.machineName,
                setupMinutes: Number(plannedProcess.setupMinutes || 0),
                runMinutes: Number(plannedProcess.runMinutes || 0),
                speedFpm: Number(plannedProcess.speedFpm || 0),
                source: plannedProcess.source || 'fallback-estimate'
            })
        ]);

        previousRouteId = insertResult.rows[0]?.id || null;
        startHour = Number((startHour + durationHours).toFixed(4));
    }
}

async function ensurePlanningSchema() {
    await pgQuery(`
        CREATE TABLE IF NOT EXISTS production_process_definitions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            process_key TEXT NOT NULL UNIQUE,
            process_name TEXT NOT NULL,
            sequence_order INTEGER NOT NULL DEFAULT 1,
            color_hex TEXT NOT NULL DEFAULT '#378ADD',
            icon_key TEXT,
            is_parallel BOOLEAN NOT NULL DEFAULT FALSE,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            source_context TEXT NOT NULL DEFAULT 'erp',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pgQuery(`
        CREATE TABLE IF NOT EXISTS production_machine_profiles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            machine_id UUID REFERENCES maquina(id) ON DELETE CASCADE,
            machine_capacity_id UUID REFERENCES maquina_capacidad(id) ON DELETE CASCADE,
            machine_name TEXT NOT NULL,
            brand TEXT,
            model TEXT,
            process_key TEXT NOT NULL,
            process_name TEXT NOT NULL,
            nominal_speed_fpm NUMERIC(12,4) NOT NULL DEFAULT 0,
            setup_minutes NUMERIC(12,4) NOT NULL DEFAULT 0,
            setup_per_station_minutes NUMERIC(12,4) NOT NULL DEFAULT 0,
            hourly_machine_cost NUMERIC(12,4) NOT NULL DEFAULT 0,
            hourly_operator_cost NUMERIC(12,4) NOT NULL DEFAULT 0,
            oee_target NUMERIC(8,4) NOT NULL DEFAULT 0.85,
            max_web_width_in NUMERIC(12,4),
            min_web_width_in NUMERIC(12,4),
            supports_die_cut BOOLEAN NOT NULL DEFAULT FALSE,
            supports_varnish_uv BOOLEAN NOT NULL DEFAULT FALSE,
            supports_lamination BOOLEAN NOT NULL DEFAULT FALSE,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (machine_capacity_id)
        )
    `);

    await pgQuery(`
        CREATE TABLE IF NOT EXISTS production_order_routes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_code TEXT NOT NULL REFERENCES flexo_orders(order_code) ON DELETE CASCADE,
            quote_code TEXT,
            line_code TEXT,
            sequence_order INTEGER NOT NULL DEFAULT 1,
            process_key TEXT NOT NULL,
            process_name TEXT NOT NULL,
            machine_profile_id UUID REFERENCES production_machine_profiles(id) ON DELETE SET NULL,
            planned_start_at TIMESTAMPTZ,
            planned_end_at TIMESTAMPTZ,
            start_turn_hour NUMERIC(8,4),
            duration_hours NUMERIC(8,4),
            actual_start_at TIMESTAMPTZ,
            actual_end_at TIMESTAMPTZ,
            dependency_route_id UUID REFERENCES production_order_routes(id) ON DELETE SET NULL,
            transition_cost_min INTEGER NOT NULL DEFAULT 0,
            route_status TEXT NOT NULL DEFAULT 'PENDIENTE',
            source_mode TEXT NOT NULL DEFAULT 'auto',
            route_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (order_code, sequence_order)
        )
    `);

    await pgQuery(`
        CREATE TABLE IF NOT EXISTS production_stop_reasons (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            reason_group TEXT NOT NULL,
            reason_code TEXT NOT NULL UNIQUE,
            description TEXT NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pgQuery(`
        CREATE TABLE IF NOT EXISTS production_route_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            route_id UUID NOT NULL REFERENCES production_order_routes(id) ON DELETE CASCADE,
            operator_name TEXT,
            event_type TEXT NOT NULL,
            stop_reason_id UUID REFERENCES production_stop_reasons(id) ON DELETE SET NULL,
            notes TEXT,
            event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pgQuery(`
        CREATE TABLE IF NOT EXISTS production_waste_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            route_id UUID NOT NULL REFERENCES production_order_routes(id) ON DELETE CASCADE,
            feet_consumed NUMERIC(14,4) DEFAULT 0,
            setup_waste_feet NUMERIC(14,4) DEFAULT 0,
            run_waste_feet NUMERIC(14,4) DEFAULT 0,
            useful_feet NUMERIC(14,4) GENERATED ALWAYS AS (COALESCE(feet_consumed,0) - COALESCE(setup_waste_feet,0) - COALESCE(run_waste_feet,0)) STORED,
            final_speed_fpm NUMERIC(12,4),
            anilox_line TEXT,
            cylinder_pressure TEXT,
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pgQuery(`CREATE INDEX IF NOT EXISTS idx_production_order_routes_order ON production_order_routes(order_code, sequence_order)`);
    await pgQuery(`CREATE INDEX IF NOT EXISTS idx_production_route_events_route ON production_route_events(route_id, created_at DESC)`);
    await pgQuery(`CREATE INDEX IF NOT EXISTS idx_production_waste_logs_route ON production_waste_logs(route_id, created_at DESC)`);

    await pgQuery(`
        INSERT INTO production_stop_reasons (reason_group, reason_code, description)
        VALUES
            ('GRP_01', 'GRP_01_REGISTRO', 'Falla de Registro'),
            ('GRP_01', 'GRP_01_BANDA', 'Rotura de Banda'),
            ('GRP_01', 'GRP_01_TENSION', 'Variacion de Tension'),
            ('GRP_01', 'GRP_01_UV', 'Falla Secado UV'),
            ('GRP_02', 'GRP_02_PLANCHA', 'Plancha Danada'),
            ('GRP_02', 'GRP_02_TINTA', 'Tinta Cortada / Fuera de Tono'),
            ('GRP_02', 'GRP_02_ADHESIVO', 'Adhesivo Defectuoso'),
            ('GRP_03', 'GRP_03_ANILOX', 'Limpieza de Anilox'),
            ('GRP_03', 'GRP_03_TURNO', 'Cambio de Turno'),
            ('GRP_03', 'GRP_03_CALIDAD', 'Esperando Aprobacion de Calidad')
        ON CONFLICT (reason_code) DO NOTHING
    `);

    const capacities = await pgQuery(`
        SELECT
            mc.id AS machine_capacity_id,
            mc.maquina_id,
            mc.proceso,
            mc.subproceso,
            mc.tiempo_preparacion_general,
            mc.tiempo_por_estacion,
            mc.velocidad_produccion,
            mc.costo_hora_maquina,
            mc.costo_hora_operario,
            mc.activa AS capacity_active,
            m.nombre,
            m.tipo,
            m.activa AS machine_active
        FROM maquina_capacidad mc
        JOIN maquina m ON m.id = mc.maquina_id
        WHERE COALESCE(mc.activa, TRUE) = TRUE
    `);

    const processRegistry = new Map();
    capacities.rows.forEach((row) => {
        const processName = pickFirstValue(row.proceso, row.subproceso, 'Produccion');
        const processKey = normalizePlanningKey(processName);
        if (!processKey) return;
        if (!processRegistry.has(processKey)) {
            processRegistry.set(processKey, {
                processKey,
                processName,
                sequenceOrder: processRegistry.size + 1,
                colorHex: '#378ADD',
                iconKey: null,
                isParallel: false
            });
        }
    });

    const seededProcesses = [
        { processKey: 'diseno', processName: 'Diseño', sequenceOrder: 1, colorHex: '#8B5CF6', iconKey: '[D]', isParallel: false },
        { processKey: 'preprensa', processName: 'Preprensa', sequenceOrder: 2, colorHex: '#6366F1', iconKey: '[PP]', isParallel: false },
        { processKey: 'impresion', processName: 'Impresión', sequenceOrder: 3, colorHex: '#1D9E75', iconKey: '[IMP]', isParallel: false },
        { processKey: 'barnizado', processName: 'Barnizado', sequenceOrder: 4, colorHex: '#BA7517', iconKey: '[B]', isParallel: true },
        { processKey: 'laminado', processName: 'Laminado', sequenceOrder: 5, colorHex: '#0EA5E9', iconKey: '[L]', isParallel: false },
        { processKey: 'estampado', processName: 'Estampado', sequenceOrder: 6, colorHex: '#F59E0B', iconKey: '[E]', isParallel: false },
        { processKey: 'embosado', processName: 'Embosado', sequenceOrder: 7, colorHex: '#A855F7', iconKey: '[EMB]', isParallel: false },
        { processKey: 'troquelado', processName: 'Troquelado', sequenceOrder: 8, colorHex: '#06B6D4', iconKey: '[T]', isParallel: false },
        { processKey: 'rebobinado', processName: 'Rebobinado', sequenceOrder: 9, colorHex: '#F97316', iconKey: '[R]', isParallel: false },
        { processKey: 'empaque', processName: 'Empaque', sequenceOrder: 10, colorHex: '#10B981', iconKey: '[EMP]', isParallel: false }
    ];
    seededProcesses.forEach((row) => {
        if (!processRegistry.has(row.processKey)) {
            processRegistry.set(row.processKey, row);
        }
    });

    for (const process of processRegistry.values()) {
        await pgQuery(`
            INSERT INTO production_process_definitions (
                process_key, process_name, sequence_order, color_hex, icon_key, is_parallel, source_context
            ) VALUES ($1,$2,$3,$4,$5,$6,'erp')
            ON CONFLICT (process_key) DO UPDATE SET
                process_name = EXCLUDED.process_name,
                sequence_order = EXCLUDED.sequence_order,
                color_hex = COALESCE(production_process_definitions.color_hex, EXCLUDED.color_hex),
                icon_key = COALESCE(production_process_definitions.icon_key, EXCLUDED.icon_key),
                updated_at = NOW()
        `, [
            process.processKey,
            process.processName,
            process.sequenceOrder,
            process.colorHex,
            process.iconKey,
            Boolean(process.isParallel)
        ]);
    }

    for (const row of capacities.rows) {
        const processName = pickFirstValue(row.proceso, row.subproceso, 'Produccion');
        const processKey = normalizePlanningKey(processName);
        if (!processKey) continue;
        await pgQuery(`
            INSERT INTO production_machine_profiles (
                machine_id, machine_capacity_id, machine_name, process_key, process_name,
                nominal_speed_fpm, setup_minutes, setup_per_station_minutes,
                hourly_machine_cost, hourly_operator_cost, is_active, source_payload
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
            ON CONFLICT (machine_capacity_id) DO UPDATE SET
                machine_name = EXCLUDED.machine_name,
                process_key = EXCLUDED.process_key,
                process_name = EXCLUDED.process_name,
                nominal_speed_fpm = EXCLUDED.nominal_speed_fpm,
                setup_minutes = EXCLUDED.setup_minutes,
                setup_per_station_minutes = EXCLUDED.setup_per_station_minutes,
                hourly_machine_cost = EXCLUDED.hourly_machine_cost,
                hourly_operator_cost = EXCLUDED.hourly_operator_cost,
                is_active = EXCLUDED.is_active,
                source_payload = EXCLUDED.source_payload,
                updated_at = NOW()
        `, [
            row.maquina_id,
            row.machine_capacity_id,
            row.nombre,
            processKey,
            processName,
            Number(row.velocidad_produccion || 0),
            Number(row.tiempo_preparacion_general || 0),
            Number(row.tiempo_por_estacion || 0),
            Number(row.costo_hora_maquina || 0),
            Number(row.costo_hora_operario || 0),
            Boolean(row.capacity_active && row.machine_active),
            JSON.stringify({
                tipo: row.tipo,
                subproceso: row.subproceso
            })
        ]);
    }
}

async function getQuoteHeaderRow(quoteCode) {
    const result = await pgQuery(`SELECT * FROM quotes WHERE quote_code = $1`, [quoteCode]);
    return result.rows[0] || null;
}

async function getLatestCalculationRow(quoteCode, lineCode) {
    const result = await pgQuery(
        `SELECT calculation_code, quote_code, line_code, product_code, customer_code, process_type, machine_name, die_code, material_code,
                quantity, subtotal_cost, total_cost, unit_price, raw_data
           FROM flexo_calculations
          WHERE quote_code = $1 AND line_code = $2
          ORDER BY created_at DESC NULLS LAST
          LIMIT 1`,
        [quoteCode, lineCode]
    );
    return result.rows[0] || null;
}

function getConfiguredCurrentUser() {
    try {
        const config = loadGeneralConfigFromFile();
        return pickFirstValue(config?.session?.currentUser, config?.general?.currentUser, 'admin');
    } catch (error) {
        return 'admin';
    }
}

async function getQuoteLineContext(quoteCode, lineCode, client = null) {
    const executor = client || { query: pgQuery };
    const [quoteResult, calcResult] = await Promise.all([
        executor.query(`SELECT * FROM quotes WHERE quote_code = $1 LIMIT 1`, [quoteCode]),
        executor.query(
            `SELECT calculation_code, quote_code, line_code, product_code, customer_code, process_type, machine_name, die_code, material_code,
                    quantity, subtotal_cost, total_cost, unit_price, raw_data
               FROM flexo_calculations
              WHERE quote_code = $1 AND line_code = $2
              ORDER BY created_at DESC NULLS LAST
              LIMIT 1`,
            [quoteCode, lineCode]
        )
    ]);
    return {
        quote: quoteResult.rows[0] || null,
        line: calcResult.rows[0] || null
    };
}

function summarizeLineForDestination(row) {
    const raw = row?.raw_data || {};
    return {
        customer_code: pickFirstValue(row?.customer_code, raw['ID CLIENTE']),
        customer_name: pickFirstValue(raw.CLIENTE, raw['CLIENTE NOMBRE']),
        job_name: pickFirstValue(raw['NOMBRE TRABAJO'], raw['Nombre Trabajo'], row?.line_code),
        created_on: pickFirstValue(raw['FECHA CREACION'], raw['FECHA CREACION DATE']),
        status: pickFirstValue(raw['SOLICITUD ESTADO'], raw['ESTADO LINEA'], 'Borrador')
    };
}

function extractLineAttachments(row) {
    const raw = row?.raw_data || {};
    const attachments = [];
    Object.entries(raw).forEach(([key, value]) => {
        if (typeof value !== 'string') return;
        const text = value.trim();
        if (!text) return;
        const keyNorm = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const looksLikeAttachment = /(adjunt|arte|manual|archivo|pdf|imagen|img|link|url|document)/.test(keyNorm)
            || /(\.pdf|\.ai|\.psd|\.cdr|\.png|\.jpg|\.jpeg|\.svg|\.zip|\.doc|\.docx|\.xls|\.xlsx)$/i.test(text)
            || /^https?:\/\//i.test(text);
        if (!looksLikeAttachment) return;
        attachments.push({
            key,
            label: key,
            value: text,
            isUrl: /^https?:\/\//i.test(text)
        });
    });
    return attachments;
}

async function getStoredAttachments(quoteCode, lineCode) {
    const result = await pgQuery(
        `SELECT id, quote_code, line_code, file_name, mime_type, file_ext, notes, uploaded_by, created_at,
                OCTET_LENGTH(DECODE(content_base64, 'base64')) AS size_bytes
           FROM quote_line_attachments
          WHERE quote_code = $1 AND line_code = $2
          ORDER BY created_at DESC`,
        [quoteCode, lineCode]
    );
    return result.rows;
}

function buildTraceabilityMetadata({ action, sourceQuoteCode, sourceLineCode, actor, timestamp }) {
    const createdAt = timestamp || new Date().toISOString();
    const createdBy = actor || getConfiguredCurrentUser();
    return {
        action: action || 'copied',
        source_quote_code: sourceQuoteCode || '',
        source_line_code: sourceLineCode || '',
        created_by: createdBy,
        created_at: createdAt
    };
}

async function cloneCalculationToQuote({ sourceRow, targetQuote, traceability = {} }) {
    const lineCode = await generateNextLineCode();
    const calculationCode = await generateNextCalculationCode();
    const baseSummary = summarizeLineForDestination(sourceRow);
    const metadata = buildTraceabilityMetadata({
        action: traceability.action,
        sourceQuoteCode: traceability.sourceQuoteCode || sourceRow?.quote_code,
        sourceLineCode: traceability.sourceLineCode || sourceRow?.line_code,
        actor: traceability.actor,
        timestamp: traceability.timestamp
    });
    const rawData = buildCalculationRawData(
        {
            quote_code: targetQuote.quote_code,
            line_code: lineCode,
            product_code: sourceRow.product_code,
            customer_code: targetQuote.customer_code,
            customer_name: targetQuote.customer_name,
            salesperson_name: targetQuote.salesperson_name,
            department: pickFirstValue(sourceRow.raw_data?.DEPARTAMENTO, 'Flexografia'),
            job_name: pickFirstValue(sourceRow.raw_data?.['NOMBRE TRABAJO'], sourceRow.raw_data?.['Nombre Trabajo'], lineCode),
            material_name: pickFirstValue(sourceRow.raw_data?.['GENERAL | MATERIAL'], sourceRow.material_code),
            material_code: sourceRow.material_code,
            status: pickFirstValue(sourceRow.raw_data?.['SOLICITUD ESTADO'], sourceRow.raw_data?.['ESTADO LINEA'], 'Borrador'),
            process_type: sourceRow.process_type,
            machine_name: sourceRow.machine_name,
            die_code: sourceRow.die_code,
            quantity: sourceRow.quantity,
            quantityProducts: sourceRow.quantity,
            total_cost: sourceRow.total_cost,
            unit_price: sourceRow.unit_price
        },
        {
            ...(sourceRow.raw_data || {}),
            'ID COTIZACION': targetQuote.quote_code,
            'ID LINEA': lineCode,
            'ID CLIENTE': targetQuote.customer_code || baseSummary.customer_code,
            CLIENTE: targetQuote.customer_name || baseSummary.customer_name,
            'CLIENTE NOMBRE': targetQuote.customer_name || baseSummary.customer_name,
            VENDEDOR: targetQuote.salesperson_name || '',
            'FECHA CREACION': targetQuote.created_on || baseSummary.created_on,
            'TRAZABILIDAD | ACCION': metadata.action,
            'TRAZABILIDAD | USUARIO': metadata.created_by,
            'TRAZABILIDAD | FECHA': metadata.created_at,
            'TRAZABILIDAD | COTIZACION ORIGEN': metadata.source_quote_code,
            'TRAZABILIDAD | LINEA ORIGEN': metadata.source_line_code,
            traceability: metadata
        }
    );

    await pgQuery(
        `INSERT INTO flexo_calculations (
            calculation_code, quote_code, line_code, product_code, customer_code, process_type, machine_name,
            die_code, material_code, quantity, subtotal_cost, total_cost, unit_price, raw_data
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
        [
            calculationCode,
            targetQuote.quote_code,
            lineCode,
            pickFirstValue(sourceRow.product_code, lineCode),
            targetQuote.customer_code,
            sourceRow.process_type,
            sourceRow.machine_name,
            sourceRow.die_code,
            sourceRow.material_code,
            sourceRow.quantity,
            sourceRow.subtotal_cost,
            sourceRow.total_cost,
            sourceRow.unit_price,
            JSON.stringify(rawData)
        ]
    );

    return await getLatestCalculationRow(targetQuote.quote_code, lineCode);
}

function buildProductionOrderRawData({ orderCode, quoteRow, lineRow, attachments = [] }) {
    const raw = lineRow?.raw_data || {};
    const metadata = buildTraceabilityMetadata({
        action: 'create-order',
        sourceQuoteCode: quoteRow?.quote_code || lineRow?.quote_code,
        sourceLineCode: lineRow?.line_code,
        actor: getConfiguredCurrentUser()
    });
    return {
        order_code: orderCode,
        source_quote_code: quoteRow?.quote_code || lineRow?.quote_code || '',
        source_line_code: lineRow?.line_code || '',
        customer_code: pickFirstValue(quoteRow?.customer_code, lineRow?.customer_code, raw['ID CLIENTE']),
        customer_name: pickFirstValue(quoteRow?.customer_name, raw.CLIENTE, raw['CLIENTE NOMBRE']),
        contact_name: pickFirstValue(quoteRow?.contact_name, raw['CLIENTE | CONTACTO NOMBRE COMPLETO']),
        email: pickFirstValue(quoteRow?.email, raw['CLIENTE | CONTACTO EMAIL']),
        phone: pickFirstValue(quoteRow?.phone, raw['CLIENTE | CONTACTO TELEFONO']),
        salesperson_name: pickFirstValue(quoteRow?.salesperson_name, raw.VENDEDOR),
        status: 'Pendiente',
        created_on: new Date().toISOString(),
        planning_control: {
            salesReleased: false,
            salesReleasedAt: null,
            salesReleasedBy: '',
            planningStatus: 'PENDIENTE_VENTAS',
            launchedToGantt: false,
            launchedAt: null,
            launchedBy: '',
            returnedAt: null,
            returnedBy: '',
            returnReason: '',
            promisedDeliveryDate: quoteRow?.due_on || null,
            scheduledDeliveryDate: null
        },
        quote_snapshot: mapQuoteHeader(quoteRow || { quote_code: lineRow?.quote_code, raw_data: {} }),
        line_snapshot: mapFlexoCalculationDetail(lineRow),
        line_summary: mapCalculationLine(lineRow),
        attachments,
        traceability: metadata,
        totals: {
            quantity: parseLegacyNumber(lineRow?.quantity),
            subtotal_cost: parseLegacyNumber(lineRow?.subtotal_cost),
            total_cost: parseLegacyNumber(lineRow?.total_cost),
            unit_price: parseLegacyNumber(lineRow?.unit_price)
        }
    };
}

function getOrderPlanningControl(rawData = {}, quoteRow = null) {
    const existing = rawData?.planning_control || rawData?.planningControl || {};
    const promisedDeliveryDate = existing.promisedDeliveryDate
        || rawData?.quote_snapshot?.due_on
        || quoteRow?.due_on
        || null;
    const planningStatus = existing.planningStatus
        || (existing.launchedToGantt ? 'EN_GANTT' : existing.salesReleased ? 'PENDIENTE_PLANIFICACION' : 'PENDIENTE_VENTAS');

    return {
        salesReleased: Boolean(existing.salesReleased),
        salesReleasedAt: existing.salesReleasedAt || null,
        salesReleasedBy: existing.salesReleasedBy || '',
        planningStatus,
        launchedToGantt: Boolean(existing.launchedToGantt || planningStatus === 'EN_GANTT'),
        launchedAt: existing.launchedAt || null,
        launchedBy: existing.launchedBy || '',
        returnedAt: existing.returnedAt || null,
        returnedBy: existing.returnedBy || '',
        returnReason: existing.returnReason || '',
        promisedDeliveryDate,
        scheduledDeliveryDate: existing.scheduledDeliveryDate || null
    };
}

function withUpdatedOrderPlanningControl(rawData = {}, updates = {}, quoteRow = null) {
    return {
        ...rawData,
        planning_control: {
            ...getOrderPlanningControl(rawData, quoteRow),
            ...updates
        }
    };
}

function buildOrderPlanningSummary(orderRow = {}, quoteRow = null) {
    return getOrderPlanningControl(orderRow?.raw_data || {}, quoteRow);
}

function isOrderVisibleInGantt(orderRow = {}) {
    const rawData = orderRow?.raw_data || {};
    const hasExplicitControl = Object.prototype.hasOwnProperty.call(rawData, 'planning_control')
        || Object.prototype.hasOwnProperty.call(rawData, 'planningControl');
    if (!hasExplicitControl) return true;
    return getOrderPlanningControl(rawData).planningStatus === 'EN_GANTT';
}

function buildQuoteRawData(payload = {}, existingRawData = {}) {
    const customerCode = pickFirstValue(payload.customer_code, existingRawData['ID CLIENTE']);
    const customerName = pickFirstValue(payload.customer_name, existingRawData['CLIENTE NOMBRE']);
    const contactName = pickFirstValue(payload.contact_name, existingRawData['CLIENTE | CONTACTO NOMBRE COMPLETO']);
    const email = pickFirstValue(payload.email, existingRawData['CLIENTE | CONTACTO EMAIL']);
    const phone = pickFirstValue(payload.phone, existingRawData['CLIENTE | CONTACTO TELEFONO']);
    const secondaryPhone = pickFirstValue(payload.phone_secondary, existingRawData['CLIENTE | CONTACTO TELEFONO SECUNDARIO']);
    const salespersonName = pickFirstValue(payload.salesperson_name, existingRawData.VENDEDOR, existingRawData['VENDEDOR | USUARIO']);
    const status = pickFirstValue(payload.status, existingRawData['Estado Cotizacion'], 'Activa');
    const dueOn = pickFirstValue(payload.due_on, existingRawData['FECHA VENCIMIENTO']);
    const createdOn = pickFirstValue(payload.created_on, existingRawData['FECHA CREACION']);

    return {
        ...existingRawData,
        'ID CLIENTE': customerCode,
        'CLIENTE NOMBRE': customerName,
        'CLIENTE | CONTACTO NOMBRE COMPLETO': contactName,
        'CLIENTE | CONTACTO EMAIL': email,
        'CLIENTE | CONTACTO TELEFONO': phone,
        'CLIENTE | CONTACTO TELEFONO SECUNDARIO': secondaryPhone,
        VENDEDOR: salespersonName,
        'VENDEDOR | USUARIO': salespersonName,
        'Estado Cotizacion': status,
        'FECHA CREACION': createdOn,
        'FECHA VENCIMIENTO': dueOn
    };
}

function buildCalculationRawData(payload = {}, existingRawData = {}) {
    const hasOwn = (key) => Object.prototype.hasOwnProperty.call(payload, key);
    const processType = pickFirstValue(payload.process_type, existingRawData['Proceso Productivo'], 'Convencional');
    const isDigital = String(processType).toLowerCase().includes('digit');
    const activePrefix = isDigital ? 'DIGITAL' : 'CONV';
    const finalizedForOrder = hasOwn('finalized_for_order') || hasOwn('finalizedForOrder')
        ? Boolean(hasOwn('finalized_for_order') ? payload.finalized_for_order : payload.finalizedForOrder)
        : Boolean(existingRawData['CODEX_FINALIZED_FOR_ORDER']);
    const quantityProducts = hasOwn('quantityProducts') || hasOwn('quantity')
        ? (parseLegacyNumber(payload.quantity) ?? parseLegacyNumber(payload.quantityProducts))
        : parseLegacyNumber(existingRawData['Cantidad Productos']);
    const quantityTypes = hasOwn('quantityTypes')
        ? parseLegacyNumber(payload.quantityTypes)
        : parseLegacyNumber(existingRawData['CANTIDAD TIPOS']);
    const quantityChanges = hasOwn('quantityChanges')
        ? parseLegacyNumber(payload.quantityChanges)
        : parseLegacyNumber(existingRawData['CANTIDAD CAMBIOS']);
    const width = hasOwn('widthInches')
        ? parseLegacyNumber(payload.widthInches)
        : parseLegacyNumber(existingRawData['DIMENSIONES ETIQUETA | ANCHO']);
    const length = hasOwn('lengthInches')
        ? parseLegacyNumber(payload.lengthInches)
        : parseLegacyNumber(existingRawData['DIMENSIONES ETIQUETA | LARGO']);
    const tintCount = hasOwn('stationCount')
        ? parseLegacyNumber(payload.stationCount)
        : parseLegacyNumber(existingRawData['CANTIDAD TINTAS']);
    const labelsPerRoll = hasOwn('labelsPerRoll')
        ? parseLegacyNumber(payload.labelsPerRoll)
        : parseLegacyNumber(existingRawData['CANTIDAD ETIQUETAS X ROLLO']);
    const coreWidth = hasOwn('coreWidth')
        ? parseLegacyNumber(payload.coreWidth)
        : parseLegacyNumber(existingRawData['ANCHO CORE']);
    const coreDiameter = hasOwn('coreDiameter')
        ? pickFirstValue(payload.coreDiameter)
        : pickFirstValue(existingRawData['DIAMETRO CORE']);
    const cmykEnabled = hasOwn('cmyk')
        ? Boolean(payload.cmyk)
        : (existingRawData['GENERAL | CMYK'] === true || String(existingRawData['CMYK'] || '').trim().toLowerCase() === 'si');
    const total = hasOwn('total_cost') || hasOwn('finalTotal')
        ? (parseLegacyNumber(payload.total_cost) ?? parseLegacyNumber(payload.finalTotal))
        : parseLegacyNumber(existingRawData['PRECIO TOTAL AL FINALIZAR']);
    const unitPrice = hasOwn('unit_price') || hasOwn('unitPrice')
        ? (parseLegacyNumber(payload.unit_price) ?? parseLegacyNumber(payload.unitPrice))
        : parseLegacyNumber(existingRawData['GENERAL | 9 | UNITARIO | DOL']);

    const rawData = {
        ...existingRawData,
        'ID COTIZACION': pickFirstValue(payload.quote_code, existingRawData['ID COTIZACION']),
        'ID LINEA': pickFirstValue(payload.line_code, existingRawData['ID LINEA']),
        'ID CLIENTE': pickFirstValue(payload.customer_code, existingRawData['ID CLIENTE']),
        CLIENTE: pickFirstValue(payload.customer_name, existingRawData.CLIENTE),
        VENDEDOR: pickFirstValue(payload.salesperson_name, existingRawData.VENDEDOR),
        DEPARTAMENTO: pickFirstValue(payload.department, existingRawData.DEPARTAMENTO, 'Flexografia'),
        'NOMBRE TRABAJO': pickFirstValue(payload.job_name, existingRawData['NOMBRE TRABAJO'], 'Nuevo cálculo'),
        'TIPO ORDEN': hasOwn('orderType') ? payload.orderType : pickFirstValue(existingRawData['TIPO ORDEN']),
        'GENERAL | MATERIAL': hasOwn('material_name')
            ? payload.material_name
            : pickFirstValue(existingRawData['GENERAL | MATERIAL'], payload.material_code),
          'SOLICITUD ESTADO': pickFirstValue(payload.status, existingRawData['SOLICITUD ESTADO'], 'Borrador'),
          'ESTADO LINEA': pickFirstValue(payload.status, existingRawData['ESTADO LINEA'], 'Borrador'),
          'CODEX_FINALIZED_FOR_ORDER': finalizedForOrder,
          'Proceso Productivo': processType,
        'TIPO ETIQUETADO': hasOwn('applicationType') ? payload.applicationType : pickFirstValue(existingRawData['TIPO ETIQUETADO']),
        'TIPO SALIDA': hasOwn('outputType') ? payload.outputType : pickFirstValue(existingRawData['TIPO SALIDA']),
        'GENERAL | TROQUEL | ID': hasOwn('die_code') ? payload.die_code : pickFirstValue(existingRawData['GENERAL | TROQUEL | ID']),
        [`${activePrefix} | MAQUINA`]: hasOwn('machine_name') ? payload.machine_name : pickFirstValue(existingRawData[`${activePrefix} | MAQUINA`]),
        'Cantidad Productos': quantityProducts,
        'CANTIDAD TIPOS': quantityTypes,
        'CANTIDAD CAMBIOS': quantityChanges,
        'CANTIDAD TINTAS': tintCount,
        'CANTIDAD ETIQUETAS X ROLLO': labelsPerRoll,
        'DIMENSIONES ETIQUETA | ANCHO': width,
        'DIMENSIONES ETIQUETA | LARGO': length,
        'ANCHO CORE': coreWidth,
        'DIAMETRO CORE': coreDiameter,
        'GENERAL | CMYK': cmykEnabled,
        'CMYK': cmykEnabled ? 'Si' : 'No',
        'PRECIO TOTAL AL FINALIZAR': total,
        'GENERAL | 9 | UNITARIO | DOL': unitPrice,
        'CODEX_UI_STATE': hasOwn('uiState') ? payload.uiState : (existingRawData['CODEX_UI_STATE'] || null)
    };

    if (payload.request_meta && typeof payload.request_meta === 'object' && !Array.isArray(payload.request_meta)) {
        Object.entries(payload.request_meta).forEach(([key, value]) => {
            rawData[key] = value;
        });
    }

    if (hasDigitalPrintingContext({
        processType,
        machineName: rawData[`${activePrefix} | MAQUINA`],
        raw: rawData
    })) {
        zeroDigitalPlateCostFields(rawData);
    }

    return rawData;
}

function applyCurrencyFieldsToRawData(rawData = {}, exchangeRateInput = null) {
    const exchangeRate = parseLegacyNumber(
        pickFirstValue(
            exchangeRateInput,
            rawData['TIPO CAMBIO'],
            rawData['TIPO CAMBIO VENTA'],
            rawData['TIPO CAMBIO COMPRA']
        )
    ) ?? 1;
    const safeRate = exchangeRate > 0 ? exchangeRate : 1;
    const totalUsd = parseLegacyNumber(rawData['PRECIO TOTAL AL FINALIZAR']);
    const unitUsd = parseLegacyNumber(rawData['GENERAL | 9 | UNITARIO | DOL']);

    rawData['TIPO CAMBIO'] = safeRate;
    rawData['TIPO CAMBIO VENTA'] = safeRate;
    rawData['TIPO CAMBIO COMPRA'] = safeRate;

    if (totalUsd !== null) {
        const totalCol = roundCurrency(totalUsd * safeRate);
        rawData['GENERAL | 7 | TOTAL | DOL'] = totalUsd;
        rawData['GENERAL | 9 | TOTAL | DOL'] = totalUsd;
        rawData['GENERAL | 7 | TOTAL | COL'] = totalCol;
        rawData['GENERAL | 9 | TOTAL | COL EXPORTAR REPORTE VENTAS'] = totalCol;
    }

    if (unitUsd !== null) {
        rawData['GENERAL | 9 | UNITARIO | COL'] = roundCurrency(unitUsd * safeRate);
    }

    return rawData;
}

async function resolveSingleInventoryMachineName(preferredMachineName = '') {
    const preferred = String(preferredMachineName || '').trim();
    if (preferred) return preferred;
    const machines = await listInventory('maquinas', { limit: 5000 });
    const activeMachines = (Array.isArray(machines) ? machines : []).filter((machine) => machine && machine.activa !== false);
    if (activeMachines.length !== 1) return '';
    return String(activeMachines[0].nombre || '').trim();
}

async function loadFlexoCatalogsFromDb() {
    const [materialsResult, diesResult, machinesResult, productsResult, globalCostsResult, outputTypes] = await Promise.all([
        pgQuery(
            `SELECT codigo, nombre, ancho_mm, gramaje_g_m2, costo_x_msi, costo_x_m2, costo_x_kg,
                    compatible_convencional, compatible_digital, tipo_proforma, activo
               FROM material
              ORDER BY codigo`
        ),
        pgQuery(
            `SELECT codigo, descripcion, descripcion_cotizaciones, clasificacion, codigo_cliente, codigo_preprensa, codigo_proveedor,
                    ancho_mm, largo_mm, desarrollo_cm, desarrollo_in, elongacion_pct, elongado, ancho_total_troquel_in,
                    largo_total_troquel_in, dimensiones_troquel_in, ancho_etiqueta_in, largo_etiqueta_in, ancho_material_in,
                    area_etiqueta_excesos_in, area_etiqueta_in, area_troquel_in2, estructura_troquel, formato, gap_in,
                    montaje_troquel, observaciones, proveedor_troquel, tension, tipo_troquel, tipo_troquel_2,
                    uso_convencional, uso_digital, usuario_creacion, vida_util_golpes_restantes, vida_util_golpes_usados,
                    vida_util_golpes_total, reemplaza_a, reemplazado_por, image_url, cantidad_filas, dientes, repeticiones, estado, activo
               FROM troquel
              ORDER BY codigo`
        ),
        pgQuery(
            `SELECT m.id,
                    m.nombre,
                    m.tipo::text AS tipo,
                    m.unidad_velocidad_produccion,
                    m.activa,
                    m.minuto_hombre,
                    m.factor_tiraje,
                    m.factor_montaje_estacion,
                    m.factor_preparacion,
                    m.macula_default_pies,
                    m.factor_tiraje_digital,
                    mc.id AS capacidad_id,
                    mc.clasificacion,
                    mc.proceso,
                    mc.subproceso,
                    mc.unidad_trabajo,
                    mc.tiempo_preparacion_general,
                    mc.tiempo_adicional_preparacion,
                    mc.tiempo_por_estacion,
                    mc.factor_proceso_por_area,
                    mc.velocidad_produccion,
                    mc.costo_hora_maquina,
                    mc.costo_hora_operario,
                    mc.formula_tiempo,
                    mc.formula_costo,
                    mc.ancho_max_in
               FROM maquina m
          LEFT JOIN maquina_capacidad mc
                 ON mc.maquina_id = m.id
                AND mc.activa IS NOT FALSE
              ORDER BY m.nombre, mc.creado_en NULLS LAST, mc.id`
        ),
        pgQuery(
            `SELECT DISTINCT ON (line_code)
                    quote_code, line_code, product_code, customer_code, process_type, machine_name, die_code, material_code, raw_data
               FROM flexo_calculations
              WHERE line_code IS NOT NULL AND line_code <> ''
              ORDER BY line_code, created_at DESC NULLS LAST`
        ),
        pgQuery(
            `SELECT minuto_hombre, factor_tiraje, factor_montaje_estacion, factor_preparacion
               FROM maquina
              ORDER BY actualizado_en DESC NULLS LAST, creado_en DESC NULLS LAST
              LIMIT 1`
        ),
        listInventory('tipos-salida', { limit: 500 })
    ]);

    const machinesById = new Map();
    machinesResult.rows.forEach((row) => {
        if (!machinesById.has(row.id)) {
            machinesById.set(row.id, {
                id: row.id,
                machineName: row.nombre,
                name: row.nombre,
                type: row.tipo,
                speedUnit: row.unidad_velocidad_produccion || 'ft/min',
                active: row.activa,
                legacyOperatorMinuteCost: Number(row.minuto_hombre || 0),
                legacyProductionSpeed: Number(row.factor_tiraje || row.factor_tiraje_digital || 0),
                legacySetupPerStationMinutes: Number(row.factor_montaje_estacion || 0),
                legacySetupBaseMinutes: Number(row.factor_preparacion || 0),
                legacySetupExtraMinutes: Number(row.macula_default_pies || 0),
                capacities: []
            });
        }
        const machine = machinesById.get(row.id);
        if (row.capacidad_id) {
            machine.capacities.push({
                id: row.capacidad_id,
                clasificacion: row.clasificacion,
                process: row.proceso,
                subprocess: row.subproceso,
                workUnit: row.unidad_trabajo,
                setupBaseMinutes: Number(row.tiempo_preparacion_general || 0),
                setupExtraMinutes: Number(row.tiempo_adicional_preparacion || 0),
                setupPerStationMinutes: Number(row.tiempo_por_estacion || 0),
                areaFactor: Number(row.factor_proceso_por_area || 0),
                productionSpeed: Number(row.velocidad_produccion || 0),
                hourlyMachineCost: Number(row.costo_hora_maquina || 0),
                hourlyOperatorCost: Number(row.costo_hora_operario || 0),
                timeFormula: row.formula_tiempo || '',
                costFormula: row.formula_costo || '',
                maxWidthInches: Number(row.ancho_max_in || 0)
            });
        }
    });

    const machines = Array.from(machinesById.values()).map((machine) => {
        const primary = machine.capacities[0] || null;
        const process = primary?.process || machine.type;
        const subprocess = primary?.subprocess || '';
        const category = classifyMachineCategory(process, subprocess);
        const isDigital = normalizeText(`${process} ${subprocess} ${machine.type}`).includes('digit');

        return {
            id: machine.id,
            machineName: machine.machineName,
            name: machine.name,
            type: machine.type,
            speedUnit: machine.speedUnit || 'ft/min',
            category,
            process,
            subprocess,
            workUnit: primary?.workUnit || '',
            active: machine.active,
            hourlyMachineCost: primary?.hourlyMachineCost ?? 0,
            hourlyOperatorCost: primary?.hourlyOperatorCost ?? (machine.legacyOperatorMinuteCost * 60),
            productionSpeed: primary?.productionSpeed ?? machine.legacyProductionSpeed,
            setupPerStationMinutes: primary?.setupPerStationMinutes ?? machine.legacySetupPerStationMinutes,
            setupBaseMinutes: primary?.setupBaseMinutes ?? machine.legacySetupBaseMinutes,
            setupExtraMinutes: primary?.setupExtraMinutes ?? machine.legacySetupExtraMinutes,
            areaFactor: primary?.areaFactor ?? 0,
            timeFormula: primary?.timeFormula || '',
            costFormula: primary?.costFormula || '',
            maxWidthInches: primary?.maxWidthInches ?? 0,
            availableColors: isDigital ? 0 : 8,
            capacities: machine.capacities
        };
    });

    const machineCategories = machines.reduce((accumulator, machine) => {
        const key = machine.category || 'impresion';
        if (!accumulator[key]) {
            accumulator[key] = [];
        }
        accumulator[key].push(machine);
        return accumulator;
    }, {});

    return {
        machines,
        machineCategories,
        materials: materialsResult.rows.map((row) => ({
            id: row.codigo,
            code: row.codigo,
            name: row.nombre,
            displayName: `${row.codigo} | ${row.nombre}`,
            widthInches: row.ancho_mm ? Number(row.ancho_mm) / 25.4 : null,
            widthMm: row.ancho_mm,
            gramaje: row.gramaje_g_m2,
            costPerMsiUsd: row.costo_x_msi,
            costPerSquareMeterUsd: row.costo_x_m2,
            costPerKgUsd: row.costo_x_kg,
            conventionalEnabled: row.compatible_convencional,
            digitalEnabled: row.compatible_digital,
            active: row.activo !== false,
            presentationType: row.tipo_proforma || ''
        })),
        dies: diesResult.rows.map((row) => ({
            id: row.codigo,
            code: row.codigo,
            description: row.descripcion,
            descripcionCotizaciones: row.descripcion_cotizaciones,
            clasificacion: row.clasificacion,
            codigoCliente: row.codigo_cliente,
            codigoPreprensa: row.codigo_preprensa,
            codigoProveedor: row.codigo_proveedor,
            ancho_mm: row.ancho_mm,
            largo_mm: row.largo_mm,
            widthMm: row.ancho_mm,
            lengthMm: row.largo_mm,
            desarrolloCm: row.desarrollo_cm,
            desarrolloIn: row.desarrollo_in,
            elongacion_pct: row.elongacion_pct,
            elongado: row.elongado,
            ancho_total_troquel_in: row.ancho_total_troquel_in,
            largo_total_troquel_in: row.largo_total_troquel_in,
            dimensionesTroquelIn: row.dimensiones_troquel_in,
            anchoEtiquetaIn: row.ancho_etiqueta_in,
            largoEtiquetaIn: row.largo_etiqueta_in,
            anchoMaterialIn: row.ancho_material_in,
            areaEtiquetaExcesosIn: row.area_etiqueta_excesos_in,
            areaEtiquetaIn: row.area_etiqueta_in,
            areaTroquelIn2: row.area_troquel_in2,
            estructuraTroquel: row.estructura_troquel,
            formato: row.formato,
            gapIn: row.gap_in,
            montajeTroquel: row.montaje_troquel,
            observaciones: row.observaciones,
            proveedorTroquel: row.proveedor_troquel,
            tension: row.tension,
            tipoTroquel: row.tipo_troquel,
            tipoTroquel2: row.tipo_troquel_2,
            usoConvencional: row.uso_convencional,
            usoDigital: row.uso_digital,
            usuarioCreacion: row.usuario_creacion,
            vidaUtilGolpesRestantes: row.vida_util_golpes_restantes,
            vidaUtilGolpesUsados: row.vida_util_golpes_usados,
            vidaUtilGolpesTotal: row.vida_util_golpes_total,
            reemplazaA: row.reemplaza_a,
            reemplazadoPor: row.reemplazado_por,
            imageUrl: row.image_url,
            teeth: row.dientes,
            rows: row.cantidad_filas,
            repetitions: row.repeticiones,
            status: row.estado,
            active: row.activo !== false
        })),
        products: productsResult.rows.map((row) => ({
            id: row.line_code || row.product_code || row.quote_code,
            lineId: row.line_code,
            quoteId: row.quote_code,
            clientId: row.customer_code,
            clientName: pickFirstValue(row.raw_data?.CLIENTE, row.raw_data?.['CLIENTE NOMBRE']),
            code: row.product_code || row.line_code,
            jobName: pickFirstValue(row.raw_data?.['NOMBRE TRABAJO'], row.raw_data?.['TIPO TRABAJO | ORDEN REFERENCIA 1'], row.line_code),
            department: pickFirstValue(row.raw_data?.DEPARTAMENTO, 'Flexografia'),
            materialName: pickFirstValue(row.raw_data?.['GENERAL | MATERIAL'], row.material_code),
            quotedMachine: pickFirstValue(row.machine_name, row.raw_data?.['CONV | MAQUINA'], row.raw_data?.['DIGITAL | MAQUINA']),
            salespersonName: pickFirstValue(row.raw_data?.VENDEDOR),
            dieId: row.die_code,
            quantityProducts: parseLegacyNumber(row.raw_data?.['Cantidad Productos']) ?? null,
            tintCount: parseLegacyNumber(row.raw_data?.['CANTIDAD TINTAS']) ?? null,
            width: parseLegacyNumber(row.raw_data?.['DIMENSIONES ETIQUETA | ANCHO']) ?? null,
            length: parseLegacyNumber(row.raw_data?.['DIMENSIONES ETIQUETA | LARGO']) ?? null,
            outputType: pickFirstValue(row.raw_data?.['TIPO SALIDA']),
            applicationType: pickFirstValue(row.raw_data?.['TIPO ETIQUETADO'])
        })),
        globalCosts: {
            commercialSettings: {
                financialPercent: Number(globalCostsResult.rows[0]?.factor_preparacion || 0),
                profitabilityPercent: Number(globalCostsResult.rows[0]?.factor_tiraje || 0),
                contingencyPercent: Number(globalCostsResult.rows[0]?.factor_montaje_estacion || 0),
                minimumCost: Number(globalCostsResult.rows[0]?.minuto_hombre || 0)
            }
        },
        outputTypes
    };
}
app.get('/api/socios', async (req, res) => {
    try {
        const search = String(req.query.q || '').trim();
        const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
        const values = [];
        let whereClause = '';

        if (search) {
            values.push(`%${search}%`);
            values.push(`%${search}%`);
            whereClause = 'WHERE partner_code ILIKE $1 OR partner_name ILIKE $2';
        }

        values.push(limit);

        const result = await pgQuery(
            `SELECT
                partner_code,
                prospect_code,
                partner_name,
                salesperson_name,
                tax_id,
                email,
                email_facturacion,
                currency_code,
                payment_terms,
                sector,
                sub_sector,
                is_tax_exempt,
                allowed_percentage,
                client_type,
                creation_date
             FROM business_partners
             ${whereClause}
             ORDER BY partner_name NULLS LAST, partner_code NULLS LAST
             LIMIT $${values.length}`,
            values
        );

        res.json({ socios: result.rows, total: result.rows.length });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible cargar los socios.' });
    }
});

app.post('/api/socios', async (req, res) => {
    try {
        const config = await loadGeneralConfig();
        const payload = {
            partner_name: String(req.body?.partner_name || '').trim(),
            tax_id: String(req.body?.tax_id || '').trim(),
            email_facturacion: String(req.body?.email_facturacion || '').trim(),
            currency_code: sanitizePartnerCodePrefix(String(req.body?.currency_code || 'USD')).slice(0, 10) || 'USD',
            payment_terms: String(req.body?.payment_terms || 'Contado').trim() || 'Contado',
            contact_name: String(req.body?.contact_name || '').trim(),
            contact_identification: String(req.body?.contact_identification || '').trim(),
            contact_mobile: String(req.body?.contact_mobile || '').trim(),
            contact_email: String(req.body?.contact_email || '').trim(),
            contact_phone: String(req.body?.contact_phone || '').trim(),
            address_country: String(req.body?.address_country || '').trim(),
            address_state_province: String(req.body?.address_state_province || '').trim(),
            address_county: String(req.body?.address_county || '').trim(),
            address_line: String(req.body?.address_line || '').trim()
        };

        if (!payload.partner_name || !payload.tax_id || !payload.email_facturacion || !payload.contact_name) {
            return res.status(400).json({ error: 'Debes completar nombre del socio, identificación fiscal, correo de facturación y nombre del contacto principal.' });
        }

        const duplicate = await withTransaction(async (client) => {
            const existing = await findExistingPartnerDuplicate(client, {
                partnerName: payload.partner_name,
                taxId: payload.tax_id
            });
            if (existing) {
                return { duplicate: existing };
            }

            const partnerCode = await generateNextPartnerCode(client, config?.general?.partnerCodePrefix || 'CL');
            const contactNameParts = splitContactName(payload.contact_name);
            const rawData = buildNewPartnerRawData(payload, partnerCode);

            await client.query(
                `INSERT INTO business_partners (
                    partner_code,
                    partner_name,
                    salesperson_name,
                    tax_id,
                    email,
                    email_facturacion,
                    currency_code,
                    payment_terms,
                    sector,
                    sub_sector,
                    is_tax_exempt,
                    allowed_percentage,
                    client_type,
                    creation_date,
                    raw_data,
                    updated_at
                ) VALUES (
                    $1, $2, '', $3, $4, $5, $6, $7, '', '', false, NULL, '', CURRENT_DATE, $8::jsonb, NOW()
                )`,
                [
                    partnerCode,
                    payload.partner_name,
                    payload.tax_id,
                    payload.contact_email,
                    payload.email_facturacion,
                    payload.currency_code,
                    payload.payment_terms,
                    JSON.stringify(rawData)
                ]
            );

            await client.query(
                `INSERT INTO business_partner_contacts (
                    partner_code,
                    contact_name,
                    first_name,
                    last_name,
                    email,
                    phone,
                    mobile,
                    fax,
                    position,
                    is_legal_representative,
                    country,
                    state_province,
                    county,
                    raw_data
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, '', 'Principal', false, $8, $9, $10, $11::jsonb
                )`,
                [
                    partnerCode,
                    payload.contact_name,
                    contactNameParts.firstName,
                    contactNameParts.lastName,
                    payload.contact_email,
                    payload.contact_phone,
                    payload.contact_mobile,
                    payload.address_country,
                    payload.address_state_province,
                    payload.address_county,
                    JSON.stringify({
                        IDENTIFICACION: payload.contact_identification,
                        ADDRESS: payload.address_line
                    })
                ]
            );

            await client.query(
                `INSERT INTO business_partner_addresses (
                    partner_code,
                    address_name,
                    address_type,
                    country,
                    state_province,
                    county,
                    district,
                    address_line,
                    zip_code,
                    raw_data
                ) VALUES (
                    $1, 'Principal', 'Facturación', $2, $3, $4, '', $5, '', $6::jsonb
                )`,
                [
                    partnerCode,
                    payload.address_country,
                    payload.address_state_province,
                    payload.address_county,
                    payload.address_line,
                    JSON.stringify({ ADDRESS: payload.address_line })
                ]
            );

            return { partnerCode };
        });

        if (duplicate?.duplicate) {
            return res.status(409).json({
                error: `Ya existe el socio ${duplicate.duplicate.partner_code} - ${duplicate.duplicate.partner_name}.`,
                existing: duplicate.duplicate
            });
        }

        const created = await pgQuery(
            `SELECT
                partner_code,
                partner_name,
                tax_id,
                email,
                email_facturacion,
                currency_code,
                payment_terms,
                creation_date
             FROM business_partners
             WHERE partner_code = $1
             LIMIT 1`,
            [duplicate.partnerCode]
        );

        res.status(201).json({
            socio: created.rows[0] || { partner_code: duplicate.partnerCode, partner_name: payload.partner_name },
            message: 'Socio creado correctamente.'
        });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible crear el socio.' });
    }
});

app.get('/api/socios/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;
        const partner = await pgQuery(
            `SELECT
                partner_code, prospect_code, partner_name, salesperson_name, tax_id, email,
                email_facturacion, currency_code, payment_terms, sector, sub_sector,
                is_tax_exempt, allowed_percentage, client_type, creation_date, raw_data
             FROM business_partners
             WHERE partner_code = $1`,
            [codigo]
        );

        if (!partner.rows.length) {
            return res.status(404).json({ error: 'Socio no encontrado.' });
        }

        const contacts = await pgQuery(
            `SELECT id, partner_code, contact_name, first_name, last_name, email, phone, mobile, fax,
                    position, is_legal_representative, country, state_province, county, raw_data
             FROM business_partner_contacts
             WHERE partner_code = $1
             ORDER BY contact_name NULLS LAST, first_name NULLS LAST`,
            [codigo]
        );

        const addresses = await pgQuery(
            `SELECT id, partner_code, address_name, address_type, country, state_province, county,
                    district, address_line, zip_code, raw_data
             FROM business_partner_addresses
             WHERE partner_code = $1
             ORDER BY address_name NULLS LAST`,
            [codigo]
        );

        const addressRows = addresses.rows.length ? addresses.rows : buildSyntheticAddressFromPartner(partner.rows[0]);
        res.json({
            socio: partner.rows[0],
            contactos: contacts.rows,
            direcciones: addressRows
        });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible cargar el socio.' });
    }
});

app.get('/api/socios/:codigo/contactos', async (req, res) => {
    try {
        const result = await pgQuery(
            `SELECT id, partner_code, contact_name, first_name, last_name, email, phone, mobile, fax,
                    position, is_legal_representative, country, state_province, county, raw_data
             FROM business_partner_contacts
             WHERE partner_code = $1
             ORDER BY contact_name NULLS LAST, first_name NULLS LAST`,
            [req.params.codigo]
        );

        res.json({ contactos: result.rows, total: result.rows.length });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible cargar los contactos del socio.' });
    }
});

app.get('/api/socios/:codigo/direcciones', async (req, res) => {
    try {
        const result = await pgQuery(
            `SELECT id, partner_code, address_name, address_type, country, state_province, county,
                    district, address_line, zip_code, raw_data
             FROM business_partner_addresses
             WHERE partner_code = $1
             ORDER BY address_name NULLS LAST`,
            [req.params.codigo]
        );

        const partner = await pgQuery(`SELECT partner_code, partner_name, raw_data FROM business_partners WHERE partner_code = $1`, [req.params.codigo]);
        const addressRows = result.rows.length ? result.rows : (partner.rows.length ? buildSyntheticAddressFromPartner(partner.rows[0]) : []);
        res.json({ direcciones: addressRows, total: addressRows.length });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible cargar las direcciones del socio.' });
    }
});

app.get('/api/cotizaciones', async (req, res) => {
    try {
        const search = String(req.query.q || '').trim();
        const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
        const values = [];
        let whereClause = '';

        if (search) {
            values.push(`%${search}%`);
            values.push(`%${search}%`);
            values.push(`%${search}%`);
            whereClause = "WHERE quote_code ILIKE $1 OR COALESCE(customer_name, '') ILIKE $2 OR COALESCE(salesperson_name, '') ILIKE $3";
        }

        values.push(limit);

        const quoteResult = await pgQuery(
            `SELECT quote_code, customer_code, customer_name, contact_name, email, salesperson_name, phone, status, created_on, due_on
             FROM quotes
             ${whereClause}
             ORDER BY quote_code DESC
             LIMIT $${values.length}`,
            values
        );

        const quoteMap = new Map();
        for (const row of quoteResult.rows) {
            quoteMap.set(row.quote_code, {
                quote_code: row.quote_code,
                customer_code: row.customer_code || '',
                customer_name: row.customer_name || '',
                contact_name: row.contact_name || '',
                email: row.email || '',
                salesperson_name: row.salesperson_name || '',
                phone: row.phone || '',
                status: row.status || '',
                created_on: row.created_on || '',
                due_on: row.due_on || '',
                exchange_sale: null,
                exchange_buy: null,
                footer_dates: '',
                footer_exchange: '',
                payment_terms: '',
                delivery_time: '',
                line_source: 'quotes'
            });
        }

        let items = Array.from(quoteMap.values()).sort((a, b) => String(b.quote_code).localeCompare(String(a.quote_code)));
        if (search) {
            const term = search.toLowerCase();
            items = items.filter((item) => [item.quote_code, item.customer_name, item.salesperson_name].join(' ').toLowerCase().includes(term));
        }

        res.json({ cotizaciones: items.slice(0, limit), total: items.length });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible cargar las cotizaciones.' });
    }
});

app.get('/api/cotizaciones/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;
        const quoteResult = await pgQuery(
            `SELECT quote_code, customer_code, customer_name, contact_name, email, salesperson_name, phone, status, created_on, due_on, raw_data
             FROM quotes
             WHERE quote_code = $1`,
            [codigo]
        );

        const calcResult = await pgQuery(
            `SELECT calculation_code, quote_code, line_code, product_code, customer_code, process_type, machine_name, die_code, material_code,
                    quantity, subtotal_cost, total_cost, unit_price, raw_data
               FROM (
                    SELECT DISTINCT ON (line_code)
                           calculation_code, quote_code, line_code, product_code, customer_code, process_type, machine_name, die_code, material_code,
                           quantity, subtotal_cost, total_cost, unit_price, raw_data, created_at
                      FROM flexo_calculations
                     WHERE quote_code = $1
                     ORDER BY line_code NULLS LAST, created_at DESC NULLS LAST, calculation_code DESC NULLS LAST
               ) latest_lines
              ORDER BY
                    CASE
                        WHEN COALESCE(latest_lines.raw_data->>'CODEX_LINE_ORDER', '') ~ '^[0-9]+$'
                            THEN (latest_lines.raw_data->>'CODEX_LINE_ORDER')::integer
                        ELSE NULL
                    END NULLS LAST,
                    line_code NULLS LAST`,
            [codigo]
        );

        if (!quoteResult.rows.length && !calcResult.rows.length) {
            return res.status(404).json({ error: 'Cotización no encontrada.' });
        }

        const quote = quoteResult.rows.length
            ? mapQuoteHeader(quoteResult.rows[0])
            : {
                quote_code: codigo,
                customer_code: pickFirstValue(calcResult.rows[0]?.raw_data?.['ID CLIENTE']),
                customer_name: pickFirstValue(calcResult.rows[0]?.raw_data?.CLIENTE),
                contact_name: '',
                email: '',
                salesperson_name: pickFirstValue(calcResult.rows[0]?.raw_data?.VENDEDOR),
                phone: '',
                status: pickFirstValue(calcResult.rows[0]?.raw_data?.['SOLICITUD ESTADO'], calcResult.rows[0]?.raw_data?.['ESTADO LINEA'], 'Activa'),
                created_on: pickFirstValue(calcResult.rows[0]?.raw_data?.['FECHA CREACION']),
                due_on: pickFirstValue(calcResult.rows[0]?.raw_data?.['FECHA VENCIMIENTO']),
                exchange_sale: pickFirstValue(calcResult.rows[0]?.raw_data?.['TIPO CAMBIO']),
                exchange_buy: pickFirstValue(calcResult.rows[0]?.raw_data?.['TIPO CAMBIO']),
                footer_dates: '',
                footer_exchange: '',
                payment_terms: '',
                delivery_time: '',
                raw_data: calcResult.rows[0]?.raw_data || {}
            };

        const lineMap = new Map();
        for (const row of calcResult.rows) {
            const mapped = mapCalculationLine(row);
            const key = mapped.line_code || row.calculation_code || `${codigo}-${lineMap.size + 1}`;
            if (!lineMap.has(key)) {
                lineMap.set(key, mapped);
            }
        }

        const lines = Array.from(lineMap.values());
        const totals = lines.reduce((acc, line) => {
            const subtotal = Number(line.subtotal_1 || 0);
            acc.subtotal1 += subtotal;
            return acc;
        }, { subtotal1: 0 });

        res.json({
            cotizacion: quote,
            lineas: lines,
            resumen: {
                compra: quote.exchange_buy,
                venta: quote.exchange_sale,
                subtotal1: Math.round((totals.subtotal1 + Number.EPSILON) * 100) / 100
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible cargar la cotización.' });
    }
});

app.delete('/api/cotizaciones/:codigo', async (req, res) => {
    try {
        const codigo = String(req.params.codigo || '').trim();
        if (!codigo) {
            return res.status(400).json({ error: 'Codigo de cotizacion invalido.' });
        }
        const deleted = await withTransaction(async (client) => {
            const orderResult = await client.query(`DELETE FROM flexo_orders WHERE quote_code = $1`, [codigo]);
            await client.query(`DELETE FROM quote_line_attachments WHERE quote_code = $1`, [codigo]);
            await client.query(`DELETE FROM quote_line_notifications WHERE quote_code = $1`, [codigo]);
            const calcResult = await client.query(`DELETE FROM flexo_calculations WHERE quote_code = $1`, [codigo]);
            const proformaResult = await client.query(`DELETE FROM quote_proformas WHERE quote_code = $1`, [codigo]);
            const quoteResult = await client.query(`DELETE FROM quotes WHERE quote_code = $1`, [codigo]);

            if (!quoteResult.rowCount && !calcResult.rowCount && !proformaResult.rowCount) {
                const error = new Error('Cotizacion no encontrada.');
                error.statusCode = 404;
                throw error;
            }

            return {
                quoteCode: codigo,
                deletedOrders: orderResult.rowCount,
                deletedQuote: quoteResult.rowCount,
                deletedLines: calcResult.rowCount,
                deletedProformas: proformaResult.rowCount
            };
        });
        res.json({ ok: true, ...deleted });
    } catch (error) {
        const status = Number(error.statusCode) || (/no se puede eliminar/i.test(error.message || '') ? 409 : /no encontrada/i.test(error.message || '') ? 404 : 400);
        res.status(status).json({ error: error.message || 'No fue posible eliminar la cotizacion.' });
    }
});

app.get('/api/config/general', async (req, res) => {
    try {
        res.json(await loadGeneralConfig());
    } catch (error) {
        res.status(500).json({ error: 'No fue posible cargar la configuración general.' });
    }
});

app.post('/api/config/general', async (req, res) => {
    try {
        const saved = await saveGeneralConfig(req.body || {});
        res.json(saved);
    } catch (error) {
        res.status(400).json({ error: 'No fue posible guardar la configuración general.' });
    }
});

app.get('/api/proformas/:codigo', async (req, res) => {
    try {
        const payload = await buildQuoteProformaPayload(req.params.codigo);
        res.json(payload);
    } catch (error) {
        const status = /no encontrada/i.test(error.message || '') ? 404 : 400;
        res.status(status).json({ error: error.message || 'No fue posible cargar la proforma.' });
    }
});

app.patch('/api/proformas/:codigo', async (req, res) => {
    try {
        const quoteCode = String(req.params.codigo || '').trim();
        if (!quoteCode) {
            return res.status(400).json({ error: 'Código de cotización inválido.' });
        }
        const before = await buildQuoteProformaPayload(quoteCode);
        if (before.status === 'closed') {
            return res.status(409).json({ error: 'La proforma ya fue cerrada y no puede editarse.' });
        }
        const config = await loadGeneralConfig();
        const configSnapshot = getProformaConfigSnapshot(config);
        const currencies = configSnapshot.currencies;
        const currencyCode = String(req.body?.currencyCode || before.currency?.code || configSnapshot.defaultCurrency).trim().toUpperCase();
        const selectedCurrency = currencies.find((item) => item.code === currencyCode) || configSnapshot.defaultCurrencyMeta;
        const exchangeRate = Number(req.body?.exchangeRate || selectedCurrency.exchangeRate || 1) || 1;
        const rawData = {
            clientCompany: sanitizeAdminUserText(req.body?.clientCompany, before.client?.company),
            clientContactName: sanitizeAdminUserText(req.body?.clientContactName, before.client?.contactName),
            clientPhone: sanitizeAdminUserText(req.body?.clientPhone, before.client?.phone),
            clientEmail: sanitizeAdminUserText(req.body?.clientEmail, before.client?.email),
            salespersonName: sanitizeAdminUserText(req.body?.salespersonName, before.seller?.name),
            currencyCode,
            exchangeRate,
            validity: sanitizeAdminUserText(req.body?.validity, before.validity),
            intro: sanitizeAdminUserText(req.body?.intro, before.intro),
            termsConditions: sanitizeAdminUserText(req.body?.termsConditions, before.termsConditions),
            paymentTerms: sanitizeAdminUserText(req.body?.paymentTerms, before.paymentTerms),
            deliveryTime: sanitizeAdminUserText(req.body?.deliveryTime, before.deliveryTime),
            technicalSpecs: sanitizeAdminUserText(req.body?.technicalSpecs, before.technicalSpecs),
            qualityPolicies: sanitizeAdminUserText(req.body?.qualityPolicies, before.qualityPolicies),
            priceDisplayMode: normalizeProformaPriceDisplayMode(req.body?.priceDisplayMode || before.priceDisplayMode)
        };
        await pgQuery(
            `INSERT INTO quote_proformas (quote_code, status, raw_data)
             VALUES ($1, 'open', $2::jsonb)
             ON CONFLICT (quote_code)
             DO UPDATE SET
                raw_data = EXCLUDED.raw_data,
                updated_at = NOW()`,
            [quoteCode, JSON.stringify(rawData)]
        );
        res.json(await buildQuoteProformaPayload(quoteCode));
    } catch (error) {
        const status = /cerrada/i.test(error.message || '') ? 409 : 400;
        res.status(status).json({ error: error.message || 'No fue posible guardar la proforma.' });
    }
});

app.post('/api/proformas/:codigo/close', async (req, res) => {
    try {
        const quoteCode = String(req.params.codigo || '').trim();
        if (!quoteCode) {
            return res.status(400).json({ error: 'Código de cotización inválido.' });
        }
        await closeQuoteProforma(quoteCode, sanitizeAdminUserText(req.body?.reason, 'manual'));
        res.json(await buildQuoteProformaPayload(quoteCode));
    } catch (error) {
        res.status(400).json({ error: error.message || 'No fue posible cerrar la proforma.' });
    }
});

app.get('/api/login-repository', async (req, res) => {
    try {
        res.json({ images: await listLoginRepositoryImages() });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible cargar el repositorio de imágenes.' });
    }
});

app.post('/api/login-repository', async (req, res) => {
    try {
        const saved = await saveLoginRepositoryImage(req.body || {});
        res.status(201).json(saved);
    } catch (error) {
        res.status(400).json({ error: error.message || 'No fue posible guardar la imagen del repositorio.' });
    }
});

app.delete('/api/login-repository/:fileName', async (req, res) => {
    try {
        await deleteLoginRepositoryImage(req.params.fileName);
        res.json({ ok: true });
    } catch (error) {
        const status = /no existe/i.test(error.message || '') ? 404 : 400;
        res.status(status).json({ error: error.message || 'No fue posible eliminar la imagen del repositorio.' });
    }
});

app.get('/api/admin-users', async (req, res) => {
    try {
        const result = await pgQuery(
            `SELECT u.id, u.full_name, u.username, u.password, u.department, u.process, u.photo_url, u.signature_url, u.permission_id,
                    p.permission_name
               FROM admin_users u
          LEFT JOIN admin_permissions p
                 ON p.id = u.permission_id
              ORDER BY LOWER(full_name), id`
        );
        res.json(result.rows.map(normalizeAdminUserRecord));
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible cargar los usuarios.' });
    }
});

app.post('/api/admin-users', async (req, res) => {
    try {
        const name = sanitizeAdminUserText(req.body?.name);
        if (!name) {
            return res.status(400).json({ error: 'El nombre es obligatorio.' });
        }
        const result = await pgQuery(
            `INSERT INTO admin_users (full_name, username, password, department, process, photo_url, signature_url, permission_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, full_name, username, password, department, process, photo_url, signature_url, permission_id`,
            [
                name,
                sanitizeAdminUserText(req.body?.username),
                sanitizeAdminUserText(req.body?.password),
                sanitizeAdminUserText(req.body?.department),
                sanitizeAdminUserText(req.body?.process),
                sanitizeAdminUserText(req.body?.photoUrl),
                sanitizeAdminUserText(req.body?.signatureUrl),
                req.body?.permissionId ? Number(req.body.permissionId) : null
            ]
        );
        const created = result.rows[0];
        if (created.permission_id) {
            const permission = await pgQuery(`SELECT permission_name FROM admin_permissions WHERE id = $1 LIMIT 1`, [created.permission_id]);
            created.permission_name = permission.rows[0]?.permission_name || '';
        }
        res.status(201).json(normalizeAdminUserRecord(created));
    } catch (error) {
        res.status(400).json({ error: error.message || 'No fue posible crear el usuario.' });
    }
});

app.patch('/api/admin-users/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({ error: 'Identificador no válido.' });
        }
        const name = sanitizeAdminUserText(req.body?.name);
        if (!name) {
            return res.status(400).json({ error: 'El nombre es obligatorio.' });
        }
        const result = await pgQuery(
            `UPDATE admin_users
                SET full_name = $2,
                    username = $3,
                    password = $4,
                    department = $5,
                    process = $6,
                    photo_url = $7,
                    signature_url = $8,
                    permission_id = $9,
                    updated_at = NOW()
              WHERE id = $1
          RETURNING id, full_name, username, password, department, process, photo_url, signature_url, permission_id`,
            [
                id,
                name,
                sanitizeAdminUserText(req.body?.username),
                sanitizeAdminUserText(req.body?.password),
                sanitizeAdminUserText(req.body?.department),
                sanitizeAdminUserText(req.body?.process),
                sanitizeAdminUserText(req.body?.photoUrl),
                sanitizeAdminUserText(req.body?.signatureUrl),
                req.body?.permissionId ? Number(req.body.permissionId) : null
            ]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        const updated = result.rows[0];
        if (updated.permission_id) {
            const permission = await pgQuery(`SELECT permission_name FROM admin_permissions WHERE id = $1 LIMIT 1`, [updated.permission_id]);
            updated.permission_name = permission.rows[0]?.permission_name || '';
        }
        res.json(normalizeAdminUserRecord(updated));
    } catch (error) {
        res.status(400).json({ error: error.message || 'No fue posible actualizar el usuario.' });
    }
});

app.delete('/api/admin-users/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({ error: 'Identificador no válido.' });
        }
        const result = await pgQuery(`DELETE FROM admin_users WHERE id = $1 RETURNING id`, [id]);
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        res.json({ ok: true, id });
    } catch (error) {
        res.status(400).json({ error: error.message || 'No fue posible eliminar el usuario.' });
    }
});

app.get('/api/admin-permissions', async (req, res) => {
    try {
        const result = await pgQuery(
            `SELECT id, permission_name, default_landing, module_permissions
               FROM admin_permissions
              ORDER BY LOWER(permission_name), id`
        );
        res.json(result.rows.map(normalizeAdminPermissionRecord));
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible cargar los permisos.' });
    }
});

app.post('/api/admin-permissions', async (req, res) => {
    try {
        const name = sanitizeAdminUserText(req.body?.name);
        if (!name) {
            return res.status(400).json({ error: 'El nombre del permiso es obligatorio.' });
        }
        const result = await pgQuery(
            `INSERT INTO admin_permissions (permission_name, default_landing, module_permissions)
             VALUES ($1, $2, $3::jsonb)
             RETURNING id, permission_name, default_landing, module_permissions`,
            [
                name,
                sanitizePresentationKey(req.body?.defaultLanding),
                JSON.stringify(normalizePermissionMatrix(req.body?.modules || {}))
            ]
        );
        res.status(201).json(normalizeAdminPermissionRecord(result.rows[0]));
    } catch (error) {
        res.status(400).json({ error: error.message || 'No fue posible crear el permiso.' });
    }
});

app.patch('/api/admin-permissions/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({ error: 'Identificador no válido.' });
        }
        const name = sanitizeAdminUserText(req.body?.name);
        if (!name) {
            return res.status(400).json({ error: 'El nombre del permiso es obligatorio.' });
        }
        const result = await pgQuery(
            `UPDATE admin_permissions
                SET permission_name = $2,
                    default_landing = $3,
                    module_permissions = $4::jsonb,
                    updated_at = NOW()
              WHERE id = $1
          RETURNING id, permission_name, default_landing, module_permissions`,
            [
                id,
                name,
                sanitizePresentationKey(req.body?.defaultLanding),
                JSON.stringify(normalizePermissionMatrix(req.body?.modules || {}))
            ]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Permiso no encontrado.' });
        }
        res.json(normalizeAdminPermissionRecord(result.rows[0]));
    } catch (error) {
        res.status(400).json({ error: error.message || 'No fue posible actualizar el permiso.' });
    }
});

app.delete('/api/admin-permissions/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({ error: 'Identificador no válido.' });
        }
        const result = await pgQuery(`DELETE FROM admin_permissions WHERE id = $1 RETURNING id`, [id]);
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Permiso no encontrado.' });
        }
        res.json({ ok: true, id });
    } catch (error) {
        res.status(400).json({ error: error.message || 'No fue posible eliminar el permiso.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const username = sanitizeAdminUserText(req.body?.username).toLowerCase();
        const password = sanitizeAdminUserText(req.body?.password);
        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña son obligatorios.' });
        }

        if ((username === 'admin' || username === 'administrador') && password === 'admin') {
            const emergencyModules = {};
            Object.keys(PRESENTATION_NAMES).forEach((key) => {
                emergencyModules[key] = 'edit';
            });
            return res.json({
                ok: true,
                user: {
                    id: 0,
                    name: 'Administrador',
                    username: 'admin',
                    department: 'Administración',
                    process: 'General',
                    photoUrl: '',
                    permissionId: null,
                    permissionName: 'Acceso de Emergencia',
                    defaultLanding: 'dashboard',
                    modules: emergencyModules
                }
            });
        }

        const result = await pgQuery(
            `SELECT u.id, u.full_name, u.username, u.department, u.process, u.photo_url,
                    u.permission_id, p.permission_name, p.default_landing, p.module_permissions
               FROM admin_users u
          LEFT JOIN admin_permissions p
                 ON p.id = u.permission_id
              WHERE (
                        LOWER(TRIM(u.username)) = $1
                     OR LOWER(TRIM(u.full_name)) = $1
                    )
                AND u.password = $2
              LIMIT 1`,
            [username, password]
        );

        if (!result.rows.length) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        const row = result.rows[0];
        res.json({
            ok: true,
            user: {
                id: Number(row.id || 0),
                name: sanitizeAdminUserText(row.full_name),
                username: sanitizeAdminUserText(row.username),
                department: sanitizeAdminUserText(row.department),
                process: sanitizeAdminUserText(row.process),
                photoUrl: sanitizeAdminUserText(row.photo_url),
                permissionId: row.permission_id == null ? null : Number(row.permission_id),
                permissionName: sanitizeAdminUserText(row.permission_name),
                defaultLanding: sanitizePresentationKey(row.default_landing),
                modules: normalizePermissionMatrix(row.module_permissions || {})
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible iniciar sesión.' });
    }
});

app.get('/api/costos-config', async (req, res) => {
    try {
        res.json(await loadCostsConfig());
    } catch (error) {
        res.status(500).json({ error: 'No fue posible cargar la configuracion de costos.' });
    }
});

app.post('/api/costos-config', async (req, res) => {
    try {
        const saved = await saveCostsConfig(req.body || {});
        res.json(saved);
    } catch (error) {
        res.status(400).json({ error: 'No fue posible guardar la configuracion de costos.' });
    }
});

app.get('/api/audit-log', async (req, res) => {
    try {
        const values = [];
        const filters = [];
        const moduleKey = String(req.query.module || '').trim();
        const presentationKey = String(req.query.presentation || '').trim();
        const changedBy = String(req.query.user || '').trim();
        const fieldSearch = String(req.query.field || '').trim();
        const dateFrom = String(req.query.dateFrom || '').trim();
        const dateTo = String(req.query.dateTo || '').trim();
        const limit = Math.min(Math.max(Number(req.query.limit) || 300, 1), 1000);

        if (moduleKey) {
            values.push(moduleKey);
            filters.push(`module_key = $${values.length}`);
        }
        if (presentationKey) {
            values.push(presentationKey);
            filters.push(`presentation_key = $${values.length}`);
        }
        if (changedBy) {
            values.push(`%${changedBy}%`);
            filters.push(`changed_by ILIKE $${values.length}`);
        }
        if (fieldSearch) {
            values.push(`%${fieldSearch}%`);
            filters.push(`(
                field_label ILIKE $${values.length}
                OR field_key ILIKE $${values.length}
                OR COALESCE(section_label, '') ILIKE $${values.length}
                OR COALESCE(row_label, '') ILIKE $${values.length}
            )`);
        }
        if (dateFrom) {
            values.push(dateFrom);
            filters.push(`changed_at >= $${values.length}::timestamptz`);
        }
        if (dateTo) {
            values.push(`${dateTo} 23:59:59`);
            filters.push(`changed_at <= $${values.length}::timestamptz`);
        }

        values.push(limit);
        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
        const result = await pgQuery(
            `SELECT id, module_key, entity_type, entity_key, presentation_key, presentation_label,
                    section_key, section_label, row_key, row_label, field_key, field_label,
                    old_value, new_value, old_value_display, new_value_display, changed_by, route, changed_at
               FROM audit_log
               ${whereClause}
              ORDER BY changed_at DESC, id DESC
              LIMIT $${values.length}`,
            values
        );

        res.json({
            items: result.rows.map((row) => ({
                id: row.id,
                module_key: row.module_key,
                entity_type: row.entity_type,
                entity_key: row.entity_key,
                presentation_key: row.presentation_key,
                presentation_label: row.presentation_label,
                section_key: row.section_key,
                section_label: row.section_label,
                row_key: row.row_key,
                row_label: row.row_label,
                field_key: row.field_key,
                field_label: row.field_label,
                old_value: row.old_value,
                new_value: row.new_value,
                old_value_display: row.old_value_display,
                new_value_display: row.new_value_display,
                changed_by: row.changed_by,
                route: row.route,
                changed_at: row.changed_at
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible cargar la auditoría.' });
    }
});

app.get('/api/clientes', async (req, res) => {
    try {
        const result = await pgQuery(
            `SELECT partner_code AS codigo, partner_name AS nombre, tax_id AS nit, email, creation_date
               FROM business_partners
              ORDER BY partner_name NULLS LAST, partner_code NULLS LAST`
        );
        res.json({ clientes: result.rows });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible cargar los clientes.' });
    }
});

app.post('/api/clientes', async (req, res) => {
    try {
        const tenantId = await getActiveTenantId();
        const payload = req.body || {};
        const partnerCode = pickFirstValue(payload.codigo, payload.partner_code);
        if (!tenantId || !partnerCode) {
            return res.status(400).json({ error: 'Debes indicar tenant y código del socio.' });
        }

        await pgQuery(
            `INSERT INTO socio (tenant_id, codigo, nombre, correo, telefono)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (tenant_id, codigo)
             DO UPDATE SET nombre = EXCLUDED.nombre, correo = EXCLUDED.correo, telefono = EXCLUDED.telefono`,
            [tenantId, partnerCode, pickFirstValue(payload.nombre, payload.partner_name), pickFirstValue(payload.email), pickFirstValue(payload.telefono, payload.phone)]
        );

        await pgQuery(
            `INSERT INTO business_partners (
                partner_code, partner_name, tax_id, email, email_facturacion, currency_code, payment_terms,
                sector, sub_sector, is_tax_exempt, allowed_percentage, client_type, creation_date, raw_data
             ) VALUES ($1, $2, $3, $4, $5, '', '', '', '', false, NULL, '', CURRENT_DATE, $6::jsonb)
             ON CONFLICT (partner_code)
             DO UPDATE SET
                partner_name = EXCLUDED.partner_name,
                tax_id = EXCLUDED.tax_id,
                email = EXCLUDED.email,
                email_facturacion = EXCLUDED.email_facturacion,
                raw_data = COALESCE(business_partners.raw_data, '{}'::jsonb) || EXCLUDED.raw_data`,
            [
                partnerCode,
                pickFirstValue(payload.nombre, payload.partner_name),
                pickFirstValue(payload.nit, payload.tax_id),
                pickFirstValue(payload.email),
                pickFirstValue(payload.email_facturacion),
                JSON.stringify({ socio: payload })
            ]
        );

        res.json({ codigo: partnerCode, message: 'Cliente guardado exitosamente.' });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible guardar el cliente.' });
    }
});

app.get('/api/productos', async (req, res) => {
    try {
        const result = await pgQuery(
            `SELECT DISTINCT ON (line_code)
                    line_code AS codigo,
                    product_code,
                    quote_code,
                    raw_data->>'NOMBRE TRABAJO' AS nombre,
                    raw_data->>'GENERAL | MATERIAL' AS material
               FROM flexo_calculations
              WHERE line_code IS NOT NULL AND line_code <> ''
              ORDER BY line_code, created_at DESC NULLS LAST`
        );
        res.json({ productos: result.rows });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible cargar los productos.' });
    }
});

app.post('/api/productos', async (req, res) => {
    res.status(501).json({ error: 'La creación directa de productos aún no está habilitada; se generan desde líneas de cotización.' });
});

app.post('/api/cotizaciones', async (req, res) => {
    try {
        const payload = req.body || {};
        const quoteCode = pickFirstValue(payload.quote_code) || await generateNextQuoteCode();
        const createdOn = pickFirstValue(payload.created_on, new Date().toISOString().slice(0, 10));
        const dueOn = pickFirstValue(payload.due_on, createdOn);
        const rawData = buildQuoteRawData({ ...payload, quote_code: quoteCode, created_on: createdOn, due_on: dueOn });

        await pgQuery(
            `INSERT INTO quotes (
                quote_code, customer_code, customer_name, contact_name, email, salesperson_name, phone, status, created_on, due_on, raw_data
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
            [
                quoteCode,
                pickFirstValue(payload.customer_code),
                pickFirstValue(payload.customer_name),
                pickFirstValue(payload.contact_name),
                pickFirstValue(payload.email),
                pickFirstValue(payload.salesperson_name, 'admin'),
                pickFirstValue(payload.phone),
                pickFirstValue(payload.status, 'Borrador'),
                createdOn,
                dueOn,
                JSON.stringify(rawData)
            ]
        );

        const detail = await pgQuery(
            `SELECT quote_code, customer_code, customer_name, contact_name, email, salesperson_name, phone, status, created_on, due_on, raw_data
               FROM quotes
              WHERE quote_code = $1`,
            [quoteCode]
        );
        res.json({ cotizacion: mapQuoteHeader(detail.rows[0]) });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible crear la cotización.' });
    }
});

app.patch('/api/cotizaciones/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;
        const existing = await pgQuery(
            `SELECT customer_code, customer_name, raw_data FROM quotes WHERE quote_code = $1`,
            [codigo]
        );

        if (!existing.rows.length) {
            return res.status(404).json({ error: 'Cotización no encontrada.' });
        }

        const payload = req.body || {};
        const lineCountResult = await pgQuery(
            `SELECT COUNT(*)::int AS total
               FROM flexo_calculations
              WHERE quote_code = $1`,
            [codigo]
        );
        const hasLines = Number(lineCountResult.rows[0]?.total || 0) > 0;
        const normalizedPayload = hasLines
            ? {
                ...payload,
                customer_code: pickFirstValue(existing.rows[0].customer_code, existing.rows[0].raw_data?.['ID CLIENTE']),
                customer_name: pickFirstValue(existing.rows[0].customer_name, existing.rows[0].raw_data?.['CLIENTE NOMBRE'])
            }
            : payload;
        const rawData = buildQuoteRawData(normalizedPayload, existing.rows[0].raw_data || {});

        await pgQuery(
            `UPDATE quotes
                SET customer_code = $2,
                    customer_name = $3,
                    contact_name = $4,
                    email = $5,
                    salesperson_name = $6,
                    phone = $7,
                    status = $8,
                    created_on = COALESCE($9, created_on),
                    due_on = COALESCE($10, due_on),
                    raw_data = $11::jsonb
              WHERE quote_code = $1`,
            [
                codigo,
                hasLines
                    ? pickFirstValue(existing.rows[0].customer_code, existing.rows[0].raw_data?.['ID CLIENTE'])
                    : pickFirstValue(normalizedPayload.customer_code, existing.rows[0].customer_code, existing.rows[0].raw_data?.['ID CLIENTE']),
                hasLines
                    ? pickFirstValue(existing.rows[0].customer_name, existing.rows[0].raw_data?.['CLIENTE NOMBRE'])
                    : pickFirstValue(normalizedPayload.customer_name, existing.rows[0].customer_name, existing.rows[0].raw_data?.['CLIENTE NOMBRE']),
                pickFirstValue(normalizedPayload.contact_name, existing.rows[0].raw_data?.['CLIENTE | CONTACTO NOMBRE COMPLETO']),
                pickFirstValue(normalizedPayload.email, existing.rows[0].raw_data?.['CLIENTE | CONTACTO EMAIL']),
                pickFirstValue(normalizedPayload.salesperson_name, existing.rows[0].raw_data?.VENDEDOR),
                pickFirstValue(normalizedPayload.phone, existing.rows[0].raw_data?.['CLIENTE | CONTACTO TELEFONO']),
                pickFirstValue(normalizedPayload.status, existing.rows[0].raw_data?.['Estado Cotizacion']),
                pickFirstValue(normalizedPayload.created_on),
                pickFirstValue(normalizedPayload.due_on),
                JSON.stringify(rawData)
            ]
        );

        const detail = await pgQuery(
            `SELECT quote_code, customer_code, customer_name, contact_name, email, salesperson_name, phone, status, created_on, due_on, raw_data
               FROM quotes
              WHERE quote_code = $1`,
            [codigo]
        );
        res.json({ cotizacion: mapQuoteHeader(detail.rows[0]) });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible guardar la cotización.' });
    }
});

app.post('/api/cotizaciones/:codigo/lineas', async (req, res) => {
    try {
        const { codigo } = req.params;
        const payload = req.body || {};
        const generalConfig = await loadGeneralConfig();
        const generalDefaults = generalConfig?.general || {};
        const costsConfig = await loadCostsConfig();
        const costDefaults = costsConfig?.general || {};
        const quoteResult = await pgQuery(`SELECT * FROM quotes WHERE quote_code = $1`, [codigo]);
        if (!quoteResult.rows.length) {
            return res.status(404).json({ error: 'Cotización no encontrada.' });
        }

        const quote = quoteResult.rows[0];
        const lineCode = pickFirstValue(payload.line_code) || await generateNextLineCode();
        const calculationCode = pickFirstValue(payload.calculation_code) || await generateNextCalculationCode();
        const machineName = await resolveSingleInventoryMachineName(payload.machine_name);
        const lineOrder = normalizeLineOrder(payload.line_order, await getNextQuoteLineOrder(codigo));
        const rawData = buildCalculationRawData({
            ...payload,
            quote_code: codigo,
            line_code: lineCode,
            customer_code: quote.customer_code,
            customer_name: quote.customer_name,
            salesperson_name: quote.salesperson_name,
            machine_name: machineName,
            coreWidth: pickFirstValue(payload.coreWidth, costDefaults.defaultRollWidth, generalDefaults.defaultRollWidth),
            coreDiameter: pickFirstValue(payload.coreDiameter, costDefaults.defaultCoreDiameter, generalDefaults.defaultCoreDiameter),
            quantityTypes: pickFirstValue(payload.quantityTypes, costDefaults.defaultQuantityTypes, generalDefaults.defaultQuantityTypes, 1),
            cmyk: Object.prototype.hasOwnProperty.call(payload, 'cmyk')
                ? payload.cmyk
                : String(costDefaults.defaultCmykEnabled ?? generalDefaults.defaultCmykEnabled ?? 'true').trim().toLowerCase() !== 'false'
        });
        rawData['CODEX_LINE_ORDER'] = lineOrder;
        applyCurrencyFieldsToRawData(rawData, payload.exchange_rate ?? payload.exchangeRate);

        await pgQuery(
            `INSERT INTO flexo_calculations (
                calculation_code, quote_code, line_code, product_code, customer_code, process_type, machine_name,
                die_code, material_code, quantity, subtotal_cost, total_cost, unit_price, raw_data
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, $11, $12, $13::jsonb)`,
            [
                calculationCode,
                codigo,
                lineCode,
                pickFirstValue(payload.product_code, lineCode),
                quote.customer_code,
                pickFirstValue(payload.process_type, 'Convencional'),
                machineName || null,
                pickFirstValue(payload.die_code),
                pickFirstValue(payload.material_code),
                parseLegacyNumber(payload.quantity) ?? parseLegacyNumber(payload.quantityProducts),
                parseLegacyNumber(payload.total_cost),
                parseLegacyNumber(payload.unit_price),
                JSON.stringify(rawData)
            ]
        );

        const detail = await pgQuery(
            `SELECT calculation_code, quote_code, line_code, product_code, customer_code, process_type, machine_name, die_code, material_code,
                    quantity, subtotal_cost, total_cost, unit_price, raw_data
               FROM flexo_calculations
              WHERE calculation_code = $1`,
            [calculationCode]
        );
        res.json({ linea: mapCalculationLine(detail.rows[0]), calculo: mapFlexoCalculationDetail(detail.rows[0]) });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible crear la línea de cotización.' });
    }
});

app.patch('/api/cotizaciones/:codigo/lineas/orden', async (req, res) => {
    try {
        const { codigo } = req.params;
        const payload = req.body || {};
        const lines = Array.isArray(payload.lineas) ? payload.lineas : [];
        if (!lines.length) {
            return res.json({ ok: true, lineas: [] });
        }

        const latestResult = await pgQuery(
            `SELECT DISTINCT ON (line_code) calculation_code, line_code, raw_data
               FROM flexo_calculations
              WHERE quote_code = $1
              ORDER BY line_code NULLS LAST, created_at DESC NULLS LAST, calculation_code DESC NULLS LAST`,
            [codigo]
        );
        const latestByLine = new Map(latestResult.rows.map((row) => [String(row.line_code || '').trim(), row]));

        for (const item of lines) {
            const lineCode = String(item?.line_code || '').trim();
            const lineOrder = normalizeLineOrder(item?.line_order);
            if (!lineCode || !lineOrder) continue;
            const current = latestByLine.get(lineCode);
            if (!current) continue;
            const rawData = { ...(current.raw_data || {}) };
            rawData['CODEX_LINE_ORDER'] = lineOrder;
            await pgQuery(
                `UPDATE flexo_calculations
                    SET raw_data = $2::jsonb
                  WHERE calculation_code = $1`,
                [current.calculation_code, JSON.stringify(rawData)]
            );
        }

        const orderedResult = await pgQuery(
            `SELECT calculation_code, quote_code, line_code, product_code, customer_code, process_type, machine_name, die_code, material_code,
                    quantity, subtotal_cost, total_cost, unit_price, raw_data
               FROM (
                    SELECT DISTINCT ON (line_code)
                           calculation_code, quote_code, line_code, product_code, customer_code, process_type, machine_name, die_code, material_code,
                           quantity, subtotal_cost, total_cost, unit_price, raw_data, created_at
                      FROM flexo_calculations
                     WHERE quote_code = $1
                     ORDER BY line_code NULLS LAST, created_at DESC NULLS LAST, calculation_code DESC NULLS LAST
               ) latest_lines
              ORDER BY
                    CASE
                        WHEN COALESCE(latest_lines.raw_data->>'CODEX_LINE_ORDER', '') ~ '^[0-9]+$'
                            THEN (latest_lines.raw_data->>'CODEX_LINE_ORDER')::integer
                        ELSE NULL
                    END NULLS LAST,
                    line_code NULLS LAST`,
            [codigo]
        );

        res.json({ ok: true, lineas: orderedResult.rows.map(mapCalculationLine) });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible guardar el orden de las lÃ­neas.' });
    }
});

app.patch('/api/cotizaciones/:codigo/lineas/:linea', async (req, res) => {
    try {
        const { codigo, linea } = req.params;
        const payload = req.body || {};
        const existing = await pgQuery(
            `SELECT calculation_code, raw_data
               FROM flexo_calculations
              WHERE quote_code = $1 AND line_code = $2
              ORDER BY created_at DESC NULLS LAST
              LIMIT 1`,
            [codigo, linea]
        );

        if (!existing.rows.length) {
            return res.status(404).json({ error: 'Línea no encontrada.' });
        }

        const machineName = await resolveSingleInventoryMachineName(payload.machine_name);
        const rawData = buildCalculationRawData(
            { ...payload, quote_code: codigo, line_code: pickFirstValue(payload.line_code, linea), machine_name: machineName },
            existing.rows[0].raw_data || {}
        );
        rawData['CODEX_LINE_ORDER'] = normalizeLineOrder(payload.line_order, normalizeLineOrder(existing.rows[0].raw_data?.['CODEX_LINE_ORDER']));
        applyCurrencyFieldsToRawData(rawData, payload.exchange_rate ?? payload.exchangeRate);
        if (Object.prototype.hasOwnProperty.call(payload, 'finalized_for_order') || Object.prototype.hasOwnProperty.call(payload, 'finalizedForOrder')) {
            rawData['CODEX_FINALIZED_FOR_ORDER'] = Boolean(Object.prototype.hasOwnProperty.call(payload, 'finalized_for_order')
                ? payload.finalized_for_order
                : payload.finalizedForOrder);
        }

        await pgQuery(
            `UPDATE flexo_calculations
                SET line_code = $3,
                    product_code = $4,
                    process_type = $5,
                    machine_name = $6,
                    die_code = $7,
                    material_code = $8,
                    quantity = $9,
                    total_cost = $10,
                    unit_price = $11,
                    raw_data = $12::jsonb
              WHERE calculation_code = $1 AND quote_code = $2`,
            [
                existing.rows[0].calculation_code,
                codigo,
                pickFirstValue(payload.line_code, linea),
                pickFirstValue(payload.product_code, payload.line_code, linea),
                pickFirstValue(payload.process_type),
                machineName || null,
                pickFirstValue(payload.die_code),
                pickFirstValue(payload.material_code),
                parseLegacyNumber(payload.quantity) ?? parseLegacyNumber(payload.quantityProducts),
                parseLegacyNumber(payload.total_cost),
                parseLegacyNumber(payload.unit_price),
                JSON.stringify(rawData)
            ]
        );

        const detail = await pgQuery(
            `SELECT calculation_code, quote_code, line_code, product_code, customer_code, process_type, machine_name, die_code, material_code,
                    quantity, subtotal_cost, total_cost, unit_price, raw_data
               FROM flexo_calculations
              WHERE calculation_code = $1`,
            [existing.rows[0].calculation_code]
        );
        res.json({ linea: mapCalculationLine(detail.rows[0]), calculo: mapFlexoCalculationDetail(detail.rows[0]) });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible guardar la línea.' });
    }
});

app.get('/api/cotizaciones-destino', async (req, res) => {
    try {
        const search = String(req.query.q || '').trim();
        const excludeQuote = String(req.query.excludeQuote || '').trim();
        const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
        const values = [];
        const filters = [];

        if (excludeQuote) {
            values.push(excludeQuote);
            filters.push(`q.quote_code <> $${values.length}`);
        }

        if (search) {
            values.push(`%${search}%`);
            filters.push(`(
                q.quote_code ILIKE $${values.length}
                OR COALESCE(q.customer_name, '') ILIKE $${values.length}
                OR COALESCE(q.salesperson_name, '') ILIKE $${values.length}
                OR EXISTS (
                    SELECT 1
                      FROM flexo_calculations fc_search
                     WHERE fc_search.quote_code = q.quote_code
                       AND (
                            COALESCE(fc_search.line_code, '') ILIKE $${values.length}
                            OR COALESCE(fc_search.product_code, '') ILIKE $${values.length}
                            OR COALESCE(fc_search.process_type, '') ILIKE $${values.length}
                            OR COALESCE(fc_search.machine_name, '') ILIKE $${values.length}
                            OR COALESCE(fc_search.material_code, '') ILIKE $${values.length}
                            OR COALESCE(fc_search.die_code, '') ILIKE $${values.length}
                       )
                )
            )`);
        }

        values.push(limit);
        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

        const result = await pgQuery(
            `SELECT q.quote_code,
                    q.customer_code,
                    q.customer_name,
                    q.salesperson_name,
                    q.created_on,
                    q.status,
                    latest.line_code AS latest_line_code,
                    latest.product_code AS latest_product_code,
                    latest.process_type AS latest_process_type,
                    latest.machine_name AS latest_machine_name,
                    latest.material_code AS latest_material_code,
                    latest.die_code AS latest_die_code,
                    product.product_name AS latest_product_name
               FROM quotes q
               LEFT JOIN LATERAL (
                    SELECT line_code, product_code, process_type, machine_name, material_code, die_code
                      FROM flexo_calculations fc
                     WHERE fc.quote_code = q.quote_code
                     ORDER BY fc.created_at DESC NULLS LAST
                     LIMIT 1
               ) latest ON TRUE
               LEFT JOIN flexo_products product
                 ON product.quote_code = q.quote_code
                AND product.line_code = latest.line_code
               ${whereClause}
              ORDER BY q.created_on DESC NULLS LAST, q.quote_code DESC
              LIMIT $${values.length}`,
            values
        );

        res.json({
            items: result.rows.map((row) => ({
                quote_code: row.quote_code,
                customer_code: pickFirstValue(row.customer_code),
                customer_name: pickFirstValue(row.customer_name),
                job_name: pickFirstValue(row.latest_product_name, row.latest_product_code, row.latest_line_code, ''),
                product_name: pickFirstValue(row.latest_product_name, row.latest_product_code, ''),
                line_code: row.latest_line_code || '',
                salesperson_name: pickFirstValue(row.salesperson_name, ''),
                machine_name: pickFirstValue(row.latest_machine_name, ''),
                process_type: pickFirstValue(row.latest_process_type, ''),
                material_name: pickFirstValue(row.latest_material_code, ''),
                die_code: pickFirstValue(row.latest_die_code, ''),
                created_on: row.created_on || '',
                status: pickFirstValue(row.status, 'Borrador')
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible buscar cotizaciones destino.' });
    }
});

app.post('/api/cotizaciones/:codigo/lineas/:linea/duplicar', async (req, res) => {
    try {
        const { codigo, linea } = req.params;
        const duplicated = await withTransaction(async (client) => {
            const context = await getQuoteLineContext(codigo, linea, client);
            if (!context.quote || !context.line) {
                throw new Error('No se encontró la línea a duplicar.');
            }
            return cloneCalculationToQuote({
                sourceRow: context.line,
                targetQuote: context.quote,
                traceability: {
                    action: 'duplicate-line',
                    sourceQuoteCode: codigo,
                    sourceLineCode: linea,
                    actor: getConfiguredCurrentUser()
                }
            });
        });

        res.json({
            ok: true,
            linea: mapCalculationLine(duplicated),
            calculo: mapFlexoCalculationDetail(duplicated)
        });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible duplicar la línea.' });
    }
});

app.post('/api/cotizaciones/:codigo/lineas/:linea/copiar', async (req, res) => {
    try {
        const { codigo, linea } = req.params;
        const targetQuoteCode = String(req.body?.targetQuoteCode || '').trim();
        if (!targetQuoteCode) {
            return res.status(400).json({ error: 'Debes indicar la cotización destino.' });
        }

        const copied = await withTransaction(async (client) => {
            const sourceContext = await getQuoteLineContext(codigo, linea, client);
            const targetContext = await getQuoteLineContext(targetQuoteCode, '__header_only__', client);
            if (!sourceContext.line) {
                throw new Error('No se encontró la línea origen.');
            }
            if (!targetContext.quote) {
                throw new Error('No se encontró la cotización destino.');
            }
            return cloneCalculationToQuote({
                sourceRow: sourceContext.line,
                targetQuote: targetContext.quote,
                traceability: {
                    action: 'copy-to-quote',
                    sourceQuoteCode: codigo,
                    sourceLineCode: linea,
                    actor: getConfiguredCurrentUser()
                }
            });
        });

        res.json({
            ok: true,
            linea: mapCalculationLine(copied),
            calculo: mapFlexoCalculationDetail(copied)
        });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible copiar la línea a otra cotización.' });
    }
});

app.post('/api/cotizaciones/:codigo/lineas/:linea/nueva-cotizacion', async (req, res) => {
    try {
        const { codigo, linea } = req.params;
        const result = await withTransaction(async (client) => {
            const context = await getQuoteLineContext(codigo, linea, client);
            if (!context.quote || !context.line) {
                throw new Error('No se encontró la línea origen.');
            }

            const quoteCode = await generateNextQuoteCode(client);
            const sourceQuote = context.quote;
            const createdBy = getConfiguredCurrentUser();
            const createdAt = new Date().toISOString();
            const rawData = buildQuoteRawData({
                quote_code: quoteCode,
                customer_code: sourceQuote.customer_code,
                customer_name: sourceQuote.customer_name,
                contact_name: sourceQuote.contact_name,
                email: sourceQuote.email,
                salesperson_name: sourceQuote.salesperson_name,
                phone: sourceQuote.phone,
                status: sourceQuote.status || 'Borrador',
                created_on: createdAt.slice(0, 10),
                due_on: sourceQuote.due_on || createdAt.slice(0, 10)
            }, sourceQuote.raw_data || {});
            rawData['TRAZABILIDAD | ACCION'] = 'create-quote-from-line';
            rawData['TRAZABILIDAD | USUARIO'] = createdBy;
            rawData['TRAZABILIDAD | FECHA'] = createdAt;
            rawData['TRAZABILIDAD | COTIZACION ORIGEN'] = codigo;
            rawData['TRAZABILIDAD | LINEA ORIGEN'] = linea;
            rawData.traceability = buildTraceabilityMetadata({
                action: 'create-quote-from-line',
                sourceQuoteCode: codigo,
                sourceLineCode: linea,
                actor: createdBy,
                timestamp: createdAt
            });

            await client.query(
                `INSERT INTO quotes (
                    quote_code, customer_code, customer_name, contact_name, email, salesperson_name, phone, status, created_on, due_on, raw_data
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
                [
                    quoteCode,
                    sourceQuote.customer_code,
                    sourceQuote.customer_name,
                    sourceQuote.contact_name,
                    sourceQuote.email,
                    sourceQuote.salesperson_name,
                    sourceQuote.phone,
                    sourceQuote.status || 'Borrador',
                    createdAt.slice(0, 10),
                    sourceQuote.due_on || createdAt.slice(0, 10),
                    JSON.stringify(rawData)
                ]
            );

            const clonedLine = await cloneCalculationToQuote({
                sourceRow: context.line,
                targetQuote: {
                    ...sourceQuote,
                    quote_code: quoteCode,
                    raw_data: rawData
                },
                traceability: {
                    action: 'create-quote-from-line',
                    sourceQuoteCode: codigo,
                    sourceLineCode: linea,
                    actor: createdBy,
                    timestamp: createdAt
                }
            });

            const quoteResult = await client.query(`SELECT * FROM quotes WHERE quote_code = $1 LIMIT 1`, [quoteCode]);
            return {
                quote: quoteResult.rows[0],
                line: clonedLine
            };
        });

        res.json({
            ok: true,
            cotizacion: mapQuoteHeader(result.quote),
            linea: mapCalculationLine(result.line),
            calculo: mapFlexoCalculationDetail(result.line)
        });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible crear una nueva cotización desde la línea.' });
    }
});

app.get('/api/cotizaciones/:codigo/lineas/:linea/adjuntos', async (req, res) => {
    try {
        const { codigo, linea } = req.params;
        const context = await getQuoteLineContext(codigo, linea);
        if (!context.line) {
            return res.status(404).json({ error: 'No se encontró la línea.' });
        }
        const stored = await getStoredAttachments(codigo, linea);
        res.json({
            items: [
                ...stored.map((item) => ({
                    id: item.id,
                    key: item.file_name,
                    label: item.file_name,
                    value: item.file_name,
                    mime_type: item.mime_type,
                    file_ext: item.file_ext,
                    notes: item.notes,
                    uploaded_by: item.uploaded_by,
                    created_at: item.created_at,
                    size_bytes: Number(item.size_bytes || 0),
                    isStored: true
                })),
                ...extractLineAttachments(context.line)
            ]
        });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible cargar los adjuntos de la línea.' });
    }
});

app.post('/api/cotizaciones/:codigo/lineas/:linea/adjuntos', async (req, res) => {
    try {
        const { codigo, linea } = req.params;
        const payload = req.body || {};
        const fileName = String(payload.fileName || '').trim();
        const contentBase64 = String(payload.contentBase64 || '').trim();
        if (!fileName || !contentBase64) {
            return res.status(400).json({ error: 'Debes indicar el nombre y contenido del archivo.' });
        }
        const context = await getQuoteLineContext(codigo, linea);
        if (!context.line) {
            return res.status(404).json({ error: 'No se encontró la línea para adjuntar archivos.' });
        }

        const insert = await pgQuery(
            `INSERT INTO quote_line_attachments (
                quote_code, line_code, file_name, mime_type, file_ext, content_base64, notes, uploaded_by
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             RETURNING id, quote_code, line_code, file_name, mime_type, file_ext, notes, uploaded_by, created_at,
                       OCTET_LENGTH(DECODE(content_base64, 'base64')) AS size_bytes`,
            [
                codigo,
                linea,
                fileName,
                pickFirstValue(payload.mimeType, 'application/octet-stream'),
                pickFirstValue(payload.fileExt, path.extname(fileName).replace('.', '')),
                contentBase64,
                pickFirstValue(payload.notes),
                pickFirstValue(payload.uploadedBy, 'admin')
            ]
        );

        res.json({ ok: true, adjunto: insert.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible guardar el adjunto.' });
    }
});

app.get('/api/adjuntos/:id/download', async (req, res) => {
    try {
        const result = await pgQuery(
            `SELECT file_name, mime_type, content_base64
               FROM quote_line_attachments
              WHERE id = $1
              LIMIT 1`,
            [req.params.id]
        );
        if (!result.rows.length) {
            return res.status(404).send('Adjunto no encontrado.');
        }
        const attachment = result.rows[0];
        const buffer = Buffer.from(String(attachment.content_base64 || ''), 'base64');
        res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${attachment.file_name}"`);
        res.send(buffer);
    } catch (error) {
        res.status(500).send(error.message || 'No fue posible descargar el adjunto.');
    }
});

app.delete('/api/adjuntos/:id', async (req, res) => {
    try {
        const result = await pgQuery(`DELETE FROM quote_line_attachments WHERE id = $1`, [req.params.id]);
        res.json({ ok: true, deleted: result.rowCount || 0 });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible eliminar el adjunto.' });
    }
});

app.put('/api/adjuntos/:id', async (req, res) => {
    try {
        const payload = req.body || {};
        const fileName = String(payload.fileName || '').trim();
        const contentBase64 = String(payload.contentBase64 || '').trim();
        if (!fileName || !contentBase64) {
            return res.status(400).json({ error: 'Debes indicar el nombre y contenido del archivo.' });
        }
        const result = await pgQuery(
            `UPDATE quote_line_attachments
                SET file_name = $2,
                    mime_type = $3,
                    file_ext = $4,
                    content_base64 = $5,
                    notes = COALESCE($6, notes),
                    uploaded_by = COALESCE($7, uploaded_by),
                    created_at = NOW()
              WHERE id = $1
              RETURNING id, quote_code, line_code, file_name, mime_type, file_ext, notes, uploaded_by, created_at,
                        OCTET_LENGTH(DECODE(content_base64, 'base64')) AS size_bytes`,
            [
                req.params.id,
                fileName,
                pickFirstValue(payload.mimeType, 'application/octet-stream'),
                pickFirstValue(payload.fileExt, path.extname(fileName).replace('.', '')),
                contentBase64,
                payload.notes ?? null,
                payload.uploadedBy ?? 'admin'
            ]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Adjunto no encontrado.' });
        }
        res.json({ ok: true, adjunto: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible actualizar el adjunto.' });
    }
});

app.delete('/api/cotizaciones/:codigo/lineas/:linea', async (req, res) => {
    try {
        const { codigo, linea } = req.params;
        const result = await pgQuery(`DELETE FROM flexo_calculations WHERE quote_code = $1 AND line_code = $2`, [codigo, linea]);
        res.json({ ok: true, deleted: result.rowCount || 0 });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible eliminar la línea.' });
    }
});

app.get('/api/cotizaciones/:codigo/lineas/:linea/exportar', async (req, res) => {
    try {
        const { codigo, linea } = req.params;
        const context = await getQuoteLineContext(codigo, linea);
        if (!context.line) {
            return res.status(404).json({ error: 'No se encontró la línea.' });
        }

        const workbook = XLSX.utils.book_new();
        const raw = context.line.raw_data || {};
        const headerRows = [
            { Campo: 'Cotización', Valor: codigo },
            { Campo: 'Cliente', Valor: pickFirstValue(context.quote?.customer_name, raw.CLIENTE, raw['CLIENTE NOMBRE']) },
            { Campo: 'ID Cliente', Valor: pickFirstValue(context.quote?.customer_code, raw['ID CLIENTE']) },
            { Campo: 'Dirigido a', Valor: pickFirstValue(context.quote?.contact_name, raw['CLIENTE | CONTACTO NOMBRE COMPLETO']) },
            { Campo: 'Correo', Valor: pickFirstValue(context.quote?.email, raw['CLIENTE | CONTACTO EMAIL']) },
            { Campo: 'Vendedor', Valor: pickFirstValue(context.quote?.salesperson_name, raw.VENDEDOR) },
            { Campo: 'Teléfono', Valor: pickFirstValue(context.quote?.phone, raw['CLIENTE | CONTACTO TELEFONO']) },
            { Campo: 'Creación', Valor: pickFirstValue(context.quote?.created_on, raw['FECHA CREACION']) },
            { Campo: 'Vencimiento', Valor: pickFirstValue(context.quote?.due_on, raw['FECHA VENCIMIENTO']) },
            { Campo: 'Estado cotización', Valor: pickFirstValue(context.quote?.status, raw['Estado Cotizacion']) }
        ];
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(headerRows), 'Encabezado');

        const lineRows = [
            { Campo: 'Línea', Valor: linea },
            { Campo: 'Departamento', Valor: pickFirstValue(raw.DEPARTAMENTO, 'Flexografia') },
            { Campo: 'Trabajo', Valor: pickFirstValue(raw['NOMBRE TRABAJO'], raw['Nombre Trabajo']) },
            { Campo: 'Proceso', Valor: pickFirstValue(context.line.process_type, raw['Proceso Productivo']) },
            { Campo: 'Máquina', Valor: pickFirstValue(context.line.machine_name, raw['CONV | MAQUINA'], raw['DIGITAL | MAQUINA']) },
            { Campo: 'Material', Valor: pickFirstValue(raw['GENERAL | MATERIAL'], context.line.material_code) },
            { Campo: 'Troquel', Valor: pickFirstValue(context.line.die_code, raw['GENERAL | TROQUEL | ID']) },
            { Campo: 'Cantidad', Valor: parseLegacyNumber(context.line.quantity) },
            { Campo: 'Ancho', Valor: parseLegacyNumber(raw['DIMENSIONES ETIQUETA | ANCHO']) },
            { Campo: 'Largo', Valor: parseLegacyNumber(raw['DIMENSIONES ETIQUETA | LARGO']) },
            { Campo: 'Cantidad tintas', Valor: parseLegacyNumber(raw['CANTIDAD TINTAS']) },
            { Campo: 'Estado línea', Valor: pickFirstValue(raw['SOLICITUD ESTADO'], raw['ESTADO LINEA']) },
            { Campo: 'Costo total', Valor: parseLegacyNumber(context.line.total_cost) },
            { Campo: 'Precio unitario', Valor: parseLegacyNumber(context.line.unit_price) },
            { Campo: 'Subtotal visible', Valor: parseLegacyNumber(raw['GENERAL | 9 | TOTAL | COL EXPORTAR REPORTE VENTAS']) || parseLegacyNumber(raw['PRECIO TOTAL AL FINALIZAR']) }
        ];
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(lineRows), 'Linea');

        const detailRows = Object.entries(raw)
            .filter(([key, value]) => value !== null && value !== undefined && value !== '')
            .map(([Campo, Valor]) => ({ Campo, Valor }));
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detailRows), 'Detalle calculo');

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=\"${codigo}-${linea}.xlsx\"`);
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible exportar la línea.' });
    }
});

app.post('/api/cotizaciones/:codigo/lineas/:linea/orden-produccion', async (req, res) => {
    try {
        const { codigo, linea } = req.params;
        const result = await withTransaction(async (client) => {
            const context = await getQuoteLineContext(codigo, linea, client);
            if (!context.line) {
                throw new Error('No se encontró la línea origen.');
            }
            if (!Boolean(context.line.finalized_for_order ?? context.line.raw_data?.['CODEX_FINALIZED_FOR_ORDER'])) {
                throw new Error('La línea debe estar finalizada antes de crear una orden de producción.');
            }

            const orderCode = await generateNextOrderCode(client);
            const attachments = extractLineAttachments(context.line);
            let rawData = buildProductionOrderRawData({
                orderCode,
                quoteRow: context.quote,
                lineRow: context.line,
                attachments
            });
            rawData = await enrichOrderRawDataWithPlanningSnapshot(rawData, client);

            await client.query(
                `INSERT INTO flexo_orders (
                    order_code, quote_code, line_code, product_code, machine_name, material_code, die_code, ordered_quantity, raw_data
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
                [
                    orderCode,
                    codigo,
                    linea,
                    context.line.product_code,
                    context.line.machine_name,
                    context.line.material_code,
                    context.line.die_code,
                    parseLegacyNumber(context.line.quantity),
                    JSON.stringify(rawData)
                ]
            );
            await closeQuoteProforma(codigo, 'order_generated', client);

            const orderResult = await client.query(`SELECT * FROM flexo_orders WHERE order_code = $1 LIMIT 1`, [orderCode]);
            return orderResult.rows[0];
        });

        res.json({
            ok: true,
            orden: result
        });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible crear la orden de producción.' });
    }
});

app.get('/api/ordenes-produccion/:codigo', async (req, res) => {
    try {
        const result = await pgQuery(`SELECT * FROM flexo_orders WHERE order_code = $1 LIMIT 1`, [req.params.codigo]);
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Orden de producción no encontrada.' });
        }
        res.json({ orden: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible cargar la orden de producción.' });
    }
});

app.get('/api/ordenes-produccion', async (req, res) => {
    try {
        const search = String(req.query.q || '').trim();
        const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 300);
        const values = [];
        let whereClause = '';
        if (search) {
            values.push(`%${search}%`);
            whereClause = `WHERE o.order_code ILIKE $1
                OR o.quote_code ILIKE $1
                OR COALESCE(o.line_code, '') ILIKE $1
                OR COALESCE(o.machine_name, '') ILIKE $1
                OR COALESCE(o.material_code, '') ILIKE $1
                OR COALESCE(o.die_code, '') ILIKE $1
                OR COALESCE(q.customer_name, '') ILIKE $1
                OR COALESCE(q.salesperson_name, '') ILIKE $1
                OR COALESCE(fc.product_code, '') ILIKE $1
                OR COALESCE(fc.process_type, '') ILIKE $1
                OR COALESCE(fp.product_name, '') ILIKE $1`;
        }

        values.push(limit);
        const result = await pgQuery(
            `SELECT o.order_code,
                    o.quote_code,
                    o.line_code,
                    o.machine_name,
                    o.material_code,
                    o.die_code,
                    o.ordered_quantity,
                    o.created_at,
                    q.customer_name,
                    q.salesperson_name,
                    fc.process_type,
                    fc.product_code,
                    fp.product_name
               FROM flexo_orders o
          LEFT JOIN quotes q
                 ON q.quote_code = o.quote_code
          LEFT JOIN LATERAL (
                    SELECT process_type, product_code
                      FROM flexo_calculations fc
                     WHERE fc.quote_code = o.quote_code
                       AND fc.line_code = o.line_code
                     ORDER BY fc.created_at DESC NULLS LAST
                     LIMIT 1
               ) fc ON TRUE
          LEFT JOIN flexo_products fp
                 ON fp.quote_code = o.quote_code
                AND fp.line_code = o.line_code
               ${whereClause}
              ORDER BY o.created_at DESC
              LIMIT $${values.length}`,
            values
        );
        res.json({
            items: result.rows.map((row) => ({
                planning: buildOrderPlanningSummary({ ...row, raw_data: {} }),
                order_code: row.order_code,
                quote_code: row.quote_code,
                line_code: row.line_code,
                customer_name: row.customer_name || '',
                job_name: row.product_name || row.product_code || '',
                product_name: row.product_name || row.product_code || '',
                salesperson_name: row.salesperson_name || '',
                machine_name: row.machine_name || '',
                process_type: row.process_type || '',
                material_name: row.material_code || '',
                die_code: row.die_code || '',
                ordered_quantity: row.ordered_quantity,
                created_at: row.created_at
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible cargar las órdenes de producción.' });
    }
});

app.patch('/api/ordenes-produccion/:codigo/planning-control', async (req, res) => {
    try {
        const action = String(req.body?.action || '').trim().toLowerCase();
        if (!action) {
            return res.status(400).json({ ok: false, error: 'Debes indicar la acción de planificación.' });
        }

        const orderResult = await pgQuery(`SELECT * FROM flexo_orders WHERE order_code = $1 LIMIT 1`, [req.params.codigo]);
        if (!orderResult.rows.length) {
            return res.status(404).json({ ok: false, error: 'Orden no encontrada.' });
        }

        const orderRow = orderResult.rows[0];
        const rawData = orderRow.raw_data || {};
        const control = getOrderPlanningControl(rawData);
        const actor = getConfiguredCurrentUser();
        const nowIso = new Date().toISOString();
        let nextRawData = rawData;

        if (action === 'release-sales') {
            nextRawData = withUpdatedOrderPlanningControl(rawData, {
                salesReleased: true,
                salesReleasedAt: nowIso,
                salesReleasedBy: actor,
                planningStatus: 'PENDIENTE_PLANIFICACION',
                launchedToGantt: false,
                launchedAt: null,
                launchedBy: '',
                returnedAt: null,
                returnedBy: '',
                returnReason: ''
            });
        } else if (action === 'launch-gantt') {
            if (control.planningStatus !== 'PENDIENTE_PLANIFICACION' && control.planningStatus !== 'EN_GANTT') {
                return res.status(400).json({ ok: false, error: 'La orden debe estar pendiente de planificación antes de lanzarla al Gantt.' });
            }
            nextRawData = withUpdatedOrderPlanningControl(rawData, {
                salesReleased: true,
                planningStatus: 'EN_GANTT',
                launchedToGantt: true,
                launchedAt: nowIso,
                launchedBy: actor,
                returnReason: ''
            });
        } else if (action === 'return-sales') {
            nextRawData = withUpdatedOrderPlanningControl(rawData, {
                salesReleased: false,
                planningStatus: 'DEVUELTA_VENTAS',
                launchedToGantt: false,
                launchedAt: null,
                launchedBy: '',
                returnedAt: nowIso,
                returnedBy: actor,
                returnReason: String(req.body?.reason || '').trim()
            });
        } else {
            return res.status(400).json({ ok: false, error: 'Acción de planificación no reconocida.' });
        }

        await pgQuery(
            `UPDATE flexo_orders
                SET raw_data = $2::jsonb
              WHERE order_code = $1`,
            [req.params.codigo, JSON.stringify(nextRawData)]
        );

        if (action === 'launch-gantt') {
            const refreshedOrder = { ...orderRow, raw_data: nextRawData };
            await ensurePlanningRoutesForOrder(refreshedOrder, null, { replaceExisting: true });
        }

        const updated = await pgQuery(`SELECT * FROM flexo_orders WHERE order_code = $1 LIMIT 1`, [req.params.codigo]);
        res.json({
            ok: true,
            orden: updated.rows[0],
            planning: buildOrderPlanningSummary(updated.rows[0])
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'No fue posible actualizar el control de planificación.' });
    }
});

app.get('/api/planificacion/lanzamiento', async (req, res) => {
    try {
        const result = await pgQuery(`
            SELECT order_code, quote_code, line_code, product_code, machine_name, material_code, die_code,
                   ordered_quantity, delivered_on, raw_data, created_at
              FROM flexo_orders
             ORDER BY created_at DESC
        `);

        const items = result.rows
            .filter((row) => !isCompletedOrderRecord(row))
            .map((row) => {
                const raw = row.raw_data || {};
                const planning = getOrderPlanningControl(raw);
                const snapshot = inferPlanningOrderSnapshot(row);
                const lineSnapshot = raw.line_snapshot || {};
                const lineRaw = lineSnapshot.raw_data || {};
                const processKeys = inferRouteProcessKeys(row);
                const tintCount = Number(lineSnapshot.tintCount || lineSnapshot.pantoneCount || lineRaw['CANTIDAD TINTAS'] || 0);
                const plannedFeet = Number(lineSnapshot.materialFeet || lineRaw['GENERAL | SUSTRATO | CONSUMO PIES'] || 0);
                const missing = [];
                if (!snapshot.machineName && processKeys.some((key) => !['preprensa', 'diseno'].includes(key))) missing.push('Máquina');
                if (!snapshot.materialName && processKeys.some((key) => ['impresion', 'barnizado', 'laminado', 'rebobinado', 'empaque'].includes(key))) missing.push('Sustrato');
                if (!snapshot.dieCode && processKeys.some((key) => ['preprensa', 'impresion', 'troquelado', 'estampado', 'embosado'].includes(key))) missing.push('Troquel / plancha');
                if (processKeys.includes('impresion') && tintCount <= 0) missing.push('Tintas');

                return {
                    orderCode: row.order_code,
                    quoteCode: row.quote_code || '',
                    lineCode: row.line_code || '',
                    customerName: snapshot.customerName || '',
                    salespersonName: raw.salesperson_name || lineSnapshot.salespersonName || '',
                    jobName: snapshot.jobName || snapshot.productName || row.product_code || '',
                    machineName: snapshot.machineName || '',
                    materialName: snapshot.materialName || '',
                    dieCode: snapshot.dieCode || '',
                    orderedQuantity: Number(row.ordered_quantity || 0),
                    plannedFeet,
                    tintCount,
                    promisedDeliveryDate: planning.promisedDeliveryDate,
                    salesReleasedAt: planning.salesReleasedAt,
                    salesReleasedBy: planning.salesReleasedBy,
                    planningStatus: planning.planningStatus,
                    processList: processKeys,
                    sellerComments: pickFirstValue(lineRaw['COMENTARIOS VENDEDOR'], lineRaw['OBSERVACIONES VENTAS']),
                    printSummary: pickFirstValue(lineSnapshot.notes?.printSummary, lineRaw['INFORMACION IMPRESION COTIZACION | MOSTRAR'], lineRaw['INFORMACION IMPRESION COTIZACION | CALCULO']),
                    createOrderValidation: pickFirstValue(lineSnapshot.validations?.crearOrden, lineRaw['ANALISIS CAMPOS CREAR ORDEN']),
                    observations: pickFirstValue(lineSnapshot.notes?.observations, lineRaw['OBSERVACIONES SOLICITUD']),
                    returnReason: planning.returnReason || '',
                    missingItems: missing
                };
            })
            .filter((item) => item.planningStatus === 'PENDIENTE_PLANIFICACION')
            .sort((a, b) => {
                const aTime = a.promisedDeliveryDate ? new Date(a.promisedDeliveryDate).getTime() : Number.MAX_SAFE_INTEGER;
                const bTime = b.promisedDeliveryDate ? new Date(b.promisedDeliveryDate).getTime() : Number.MAX_SAFE_INTEGER;
                return aTime - bTime;
            });

        res.json({ ok: true, items });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'No fue posible cargar la cola de planificación.' });
    }
});

app.get('/api/planificacion/procesos', async (req, res) => {
    try {
        const result = await pgQuery(`
            SELECT
                   p.id AS id_proceso,
                   p.process_key,
                   p.process_name AS nombre,
                   p.sequence_order AS orden_secuencia,
                   p.color_hex,
                   p.icon_key AS icono,
                   p.is_parallel AS es_paralelo,
                   p.is_active AS activo,
                   COUNT(mp.id) FILTER (WHERE mp.is_active = TRUE) AS total_maquinas
            FROM production_process_definitions p
            LEFT JOIN production_machine_profiles mp ON mp.process_key = p.process_key
            GROUP BY p.id
            ORDER BY p.sequence_order, p.process_name
        `);
        res.json({ ok: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'No fue posible cargar los procesos de planificación.' });
    }
});

app.get('/api/planificacion/maquinas', async (req, res) => {
    try {
        const result = await pgQuery(`
            SELECT
                   mp.id::text AS id,
                   mp.id::text AS id_maquina,
                   COALESCE(NULLIF(mp.source_payload->>'external_id', ''), '') AS codigo_maquina,
                   mp.machine_name AS name,
                   mp.machine_name AS nombre_recurso,
                   mp.process_key,
                   mp.process_name AS proceso_nombre,
                   p.sequence_order AS orden_secuencia,
                   p.color_hex,
                   p.icon_key AS proceso_icono,
                   p.is_parallel AS es_paralelo
            FROM production_machine_profiles mp
            LEFT JOIN production_process_definitions p ON p.process_key = mp.process_key
            WHERE mp.is_active = TRUE
            ORDER BY p.sequence_order, mp.process_name, mp.machine_name
        `);
        res.json({ ok: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'No fue posible cargar las máquinas de planificación.' });
    }
});

app.get('/api/planificacion/maquinas/config', async (req, res) => {
    try {
        const result = await pgQuery(`
            SELECT
                mp.id::text AS id,
                mp.id::text AS id_maquina,
                COALESCE(NULLIF(mp.source_payload->>'external_id', ''), '') AS codigo_maquina,
                mp.machine_name AS nombre_recurso,
                mp.machine_name AS name,
                COALESCE(mp.source_payload->>'sub_descripcion', '') AS sub_descripcion,
                p.id AS id_proceso,
                mp.process_name AS proceso_nombre,
                p.sequence_order AS orden_secuencia,
                p.color_hex,
                p.icon_key AS proceso_icono,
                COALESCE((mp.source_payload->>'capacidad_colores')::int, 0) AS capacidad_colores,
                mp.nominal_speed_fpm AS velocidad_nom,
                mp.oee_target AS oee,
                mp.supports_die_cut AS flag_troquel,
                mp.supports_varnish_uv AS flag_barniz_uv,
                mp.supports_lamination AS flag_laminado,
                mp.max_web_width_in AS ancho_max_banda,
                mp.min_web_width_in AS ancho_min_banda,
                mp.is_active AS activa
            FROM production_machine_profiles mp
            LEFT JOIN production_process_definitions p ON p.process_key = mp.process_key
            ORDER BY p.sequence_order, mp.machine_name
        `);
        res.json({ ok: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'No fue posible cargar la configuración de máquinas.' });
    }
});

app.post('/api/planificacion/procesos', async (req, res) => {
    try {
        const { nombre, orden_secuencia, color_hex, icono, es_paralelo, activo } = req.body || {};
        if (!nombre || !orden_secuencia) {
            return res.status(400).json({ ok: false, error: 'nombre y orden_secuencia son requeridos.' });
        }
        const processKey = normalizePlanningKey(nombre);
        const result = await pgQuery(`
            INSERT INTO production_process_definitions (
                process_key, process_name, sequence_order, color_hex, icon_key, is_parallel, is_active
            ) VALUES ($1,$2,$3,$4,$5,$6,$7)
            RETURNING
                id AS id_proceso,
                process_key,
                process_name AS nombre,
                sequence_order AS orden_secuencia,
                color_hex,
                icon_key AS icono,
                is_parallel AS es_paralelo,
                is_active AS activo
        `, [processKey, nombre, Number(orden_secuencia), color_hex || '#378ADD', icono || '[P]', Boolean(es_paralelo), activo !== false]);
        res.json({ ok: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'No fue posible crear el proceso de planificación.' });
    }
});

app.put('/api/planificacion/procesos/:id', async (req, res) => {
    try {
        const { nombre, orden_secuencia, color_hex, icono, es_paralelo, activo } = req.body || {};
        const result = await pgQuery(`
            UPDATE production_process_definitions
            SET process_name = COALESCE($1, process_name),
                sequence_order = COALESCE($2, sequence_order),
                color_hex = COALESCE($3, color_hex),
                icon_key = COALESCE($4, icon_key),
                is_parallel = COALESCE($5, is_parallel),
                is_active = COALESCE($6, is_active),
                updated_at = NOW()
            WHERE id = $7::uuid
            RETURNING
                id AS id_proceso,
                process_key,
                process_name AS nombre,
                sequence_order AS orden_secuencia,
                color_hex,
                icon_key AS icono,
                is_parallel AS es_paralelo,
                is_active AS activo
        `, [nombre || null, orden_secuencia ? Number(orden_secuencia) : null, color_hex || null, icono || null, typeof es_paralelo === 'boolean' ? es_paralelo : null, typeof activo === 'boolean' ? activo : null, req.params.id]);
        if (!result.rows.length) {
            return res.status(404).json({ ok: false, error: 'Proceso no encontrado.' });
        }
        res.json({ ok: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'No fue posible actualizar el proceso.' });
    }
});

app.delete('/api/planificacion/procesos/:id', async (req, res) => {
    try {
        const countResult = await pgQuery(`SELECT COUNT(*)::int AS total FROM production_machine_profiles WHERE process_key = (SELECT process_key FROM production_process_definitions WHERE id = $1::uuid)`, [req.params.id]);
        if (Number(countResult.rows[0]?.total || 0) > 0) {
            return res.status(400).json({ ok: false, error: 'Tiene máquinas asignadas. Reasígnalas primero.' });
        }
        await pgQuery(`DELETE FROM production_process_definitions WHERE id = $1::uuid`, [req.params.id]);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'No fue posible eliminar el proceso.' });
    }
});

app.post('/api/planificacion/maquinas', async (req, res) => {
    try {
        const payload = req.body || {};
        const processResult = await pgQuery(`SELECT process_key, process_name FROM production_process_definitions WHERE id = $1::uuid LIMIT 1`, [payload.id_proceso]);
        const process = processResult.rows[0];
        if (!process) {
            return res.status(400).json({ ok: false, error: 'Proceso no válido.' });
        }
        const result = await pgQuery(`
            INSERT INTO production_machine_profiles (
                machine_name, process_key, process_name, nominal_speed_fpm, oee_target,
                max_web_width_in, min_web_width_in, supports_die_cut, supports_varnish_uv,
                supports_lamination, is_active, source_payload
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
            RETURNING id::text AS id_maquina
        `, [
            payload.nombre_recurso,
            process.process_key,
            process.process_name,
            Number(payload.velocidad_nom || 0),
            Number(payload.oee || 0.85),
            payload.ancho_max_banda ? Number(payload.ancho_max_banda) : null,
            payload.ancho_min_banda ? Number(payload.ancho_min_banda) : null,
            Boolean(payload.flag_troquel),
            Boolean(payload.flag_barniz_uv),
            Boolean(payload.flag_laminado),
            payload.activa !== false,
            JSON.stringify({
                external_id: payload.id_maquina || null,
                sub_descripcion: payload.sub_descripcion || '',
                capacidad_colores: Number(payload.capacidad_colores || 0)
            })
        ]);
        res.json({ ok: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'No fue posible crear la máquina.' });
    }
});

app.put('/api/planificacion/maquinas/:id', async (req, res) => {
    try {
        const payload = req.body || {};
        let processKey = null;
        let processName = null;
        if (payload.id_proceso) {
            const processResult = await pgQuery(`SELECT process_key, process_name FROM production_process_definitions WHERE id = $1::uuid LIMIT 1`, [payload.id_proceso]);
            processKey = processResult.rows[0]?.process_key || null;
            processName = processResult.rows[0]?.process_name || null;
        }
        const result = await pgQuery(`
            UPDATE production_machine_profiles
            SET machine_name = COALESCE($1, machine_name),
                process_key = COALESCE($2, process_key),
                process_name = COALESCE($3, process_name),
                nominal_speed_fpm = COALESCE($4, nominal_speed_fpm),
                oee_target = COALESCE($5, oee_target),
                max_web_width_in = COALESCE($6, max_web_width_in),
                min_web_width_in = COALESCE($7, min_web_width_in),
                supports_die_cut = COALESCE($8, supports_die_cut),
                supports_varnish_uv = COALESCE($9, supports_varnish_uv),
                supports_lamination = COALESCE($10, supports_lamination),
                is_active = COALESCE($11, is_active),
                source_payload = COALESCE($12::jsonb, source_payload),
                updated_at = NOW()
            WHERE id = $13::uuid
            RETURNING id::text AS id_maquina
        `, [
            payload.nombre_recurso || null,
            processKey,
            processName,
            payload.velocidad_nom !== undefined ? Number(payload.velocidad_nom || 0) : null,
            payload.oee !== undefined ? Number(payload.oee || 0.85) : null,
            payload.ancho_max_banda ? Number(payload.ancho_max_banda) : null,
            payload.ancho_min_banda ? Number(payload.ancho_min_banda) : null,
            typeof payload.flag_troquel === 'boolean' ? payload.flag_troquel : null,
            typeof payload.flag_barniz_uv === 'boolean' ? payload.flag_barniz_uv : null,
            typeof payload.flag_laminado === 'boolean' ? payload.flag_laminado : null,
            typeof payload.activa === 'boolean' ? payload.activa : null,
            JSON.stringify({
                external_id: payload.id_maquina || null,
                sub_descripcion: payload.sub_descripcion || '',
                capacidad_colores: Number(payload.capacidad_colores || 0)
            }),
            req.params.id
        ]);
        if (!result.rows.length) {
            return res.status(404).json({ ok: false, error: 'Máquina no encontrada.' });
        }
        res.json({ ok: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'No fue posible actualizar la máquina.' });
    }
});

app.delete('/api/planificacion/maquinas/:id', async (req, res) => {
    try {
        await pgQuery(`UPDATE production_machine_profiles SET is_active = FALSE, updated_at = NOW() WHERE id = $1::uuid`, [req.params.id]);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'No fue posible desactivar la máquina.' });
    }
});

app.get('/api/planificacion/gantt-agrupado', async (req, res) => {
    try {
        await ensurePlanningRoutesForLiveOrders();

        const [machinesResult, routesResult] = await Promise.all([
            pgQuery(`
                SELECT mp.id::text AS id,
                       mp.id::text AS id_maquina,
                       mp.machine_id,
                       mp.machine_capacity_id,
                       mp.machine_name AS nombre_recurso,
                       mp.machine_name AS name,
                       mp.process_key,
                       mp.process_name AS proceso_nombre,
                       p.id AS id_proceso,
                       p.sequence_order AS orden_secuencia,
                       p.color_hex,
                       p.icon_key AS proceso_icono,
                       mp.nominal_speed_fpm AS velocidad_nom,
                       mp.oee_target AS oee,
                       mp.supports_die_cut AS flag_troquel,
                       mp.supports_varnish_uv AS flag_barniz_uv,
                       mp.supports_lamination AS flag_laminado,
                       mp.max_web_width_in AS ancho_max_banda,
                       mp.min_web_width_in AS ancho_min_banda,
                       mp.is_active AS activa
                FROM production_machine_profiles mp
                LEFT JOIN production_process_definitions p ON p.process_key = mp.process_key
                WHERE mp.is_active = TRUE
                ORDER BY p.sequence_order, mp.machine_name
            `),
            pgQuery(`
                SELECT
                    r.id::text AS id_ruta,
                    r.order_code AS codigo_op,
                    r.quote_code,
                    r.line_code,
                    o.raw_data->>'customer_name' AS cliente,
                    COALESCE(o.raw_data->'line_summary'->>'job_name', o.raw_data->'line_summary'->>'product_name', o.product_code) AS articulo,
                    o.die_code AS saidel,
                    COALESCE(NULLIF(o.raw_data->'line_snapshot'->>'pantoneCount','')::numeric, NULLIF(o.raw_data->'line_snapshot'->>'tintCount','')::numeric, 0) AS colores,
                    COALESCE(NULLIF(o.raw_data->'line_snapshot'->>'materialFeet','')::numeric, o.ordered_quantity, 0) AS pies,
                    r.process_name AS proceso,
                    mp.id AS maquina,
                    COALESCE(mp.machine_name, o.machine_name) AS maquina_nombre,
                    COALESCE(r.start_turn_hour, 0) AS inicio,
                    COALESCE(r.duration_hours, 0) AS dur,
                    r.transition_cost_min AS trans_costo,
                    r.dependency_route_id AS dep_ruta_id,
                    dep.order_code AS dep,
                    r.route_status AS estado,
                    r.route_payload,
                    o.raw_data->'planning_snapshot' AS planning_snapshot,
                    NULL::text AS alerta,
                    COALESCE(
                        NULLIF(o.raw_data->'planning_control'->>'scheduledDeliveryDate', '')::timestamptz,
                        NULLIF(o.raw_data->'planning_control'->>'promisedDeliveryDate', '')::timestamptz,
                        NULLIF(o.raw_data->'quote_snapshot'->>'due_on', '')::timestamptz,
                        NULLIF(o.raw_data->'line_snapshot'->>'dueOn', '')::timestamptz
                    ) AS fecha_entrega_prometida
                FROM production_order_routes r
                JOIN flexo_orders o ON o.order_code = r.order_code
                LEFT JOIN production_machine_profiles mp ON mp.id = r.machine_profile_id
                LEFT JOIN production_order_routes dep ON dep.id = r.dependency_route_id
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM flexo_orders ox
                    WHERE ox.order_code = o.order_code
                      AND (
                        ox.delivered_on IS NOT NULL
                        OR lower(COALESCE(ox.raw_data->>'status','')) IN ('entregada','completada','cerrada','cancelada')
                      )
                )
                ORDER BY r.sequence_order, mp.machine_name NULLS LAST, r.order_code
            `)
        ]);

        res.json({
            ok: true,
            maquinas: machinesResult.rows,
            rutas: routesResult.rows
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'No fue posible cargar el gantt de planificación.' });
    }
});

app.patch('/api/planificacion/gantt/mover', async (req, res) => {
    try {
        const { id_ruta, inicio, duracion, id_maquina, route_payload_updates } = req.body || {};
        if (!id_ruta) {
            return res.status(400).json({ ok: false, error: 'Debes indicar id_ruta.' });
        }
        await pgQuery(`
            UPDATE production_order_routes
            SET start_turn_hour = COALESCE($1, start_turn_hour),
                duration_hours = COALESCE($2, duration_hours),
                machine_profile_id = COALESCE($3::uuid, machine_profile_id),
                route_payload = CASE
                    WHEN $4::jsonb IS NULL THEN route_payload
                    ELSE COALESCE(route_payload, '{}'::jsonb) || $4::jsonb
                END,
                updated_at = NOW()
            WHERE id = $5::uuid
        `, [
            inicio !== undefined ? Number(inicio) : null,
            duracion !== undefined ? Number(duracion) : null,
            id_maquina || null,
            route_payload_updates ? JSON.stringify(route_payload_updates) : null,
            id_ruta
        ]);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'No fue posible mover la ruta.' });
    }
});

app.patch('/api/planificacion/gantt/estado', async (req, res) => {
    try {
        const { codigo_op, estado } = req.body || {};
        if (!codigo_op || !estado) {
            return res.status(400).json({ ok: false, error: 'Debes indicar codigo_op y estado.' });
        }
        await pgQuery(`
            UPDATE production_order_routes
            SET route_status = $1,
                updated_at = NOW()
            WHERE order_code = $2
        `, [estado, codigo_op]);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'No fue posible actualizar el estado de la ruta.' });
    }
});

app.get('/api/planificacion/preturno', async (req, res) => {
    try {
        await ensurePlanningRoutesForLiveOrders();
        const [routesResult, materialRows, troquelRows, machineRows] = await Promise.all([
            pgQuery(`
                SELECT
                    r.id,
                    r.order_code,
                    r.process_name,
                    r.route_status,
                    r.sequence_order,
                    mp.machine_name,
                    o.material_code,
                    o.die_code,
                    o.raw_data->>'customer_name' AS customer_name,
                    COALESCE(o.raw_data->'line_summary'->>'job_name', o.raw_data->'line_summary'->>'product_name', o.product_code) AS job_name,
                    o.raw_data
                FROM production_order_routes r
                JOIN flexo_orders o ON o.order_code = r.order_code
                LEFT JOIN production_machine_profiles mp ON mp.id = r.machine_profile_id
                ORDER BY r.order_code, r.sequence_order
            `),
            listInventory('materiales', { limit: 5000 }),
            listInventory('troqueles', { limit: 5000 }),
            listInventory('maquinas', { limit: 5000 })
        ]);

        const grouped = new Map();
        const normalizePlanningKey = (value) => String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();
        const normalizedLookup = (value) => normalizePlanningKey(value);
        const hasValue = (value) => {
            const raw = String(value ?? '').trim();
            if (!raw) return false;
            const lowered = raw.toLowerCase();
            return lowered !== 'seleccionar...' && lowered !== 'seleccionar' && lowered !== 'pendiente' && lowered !== 'sin definir';
        };
        const materialCatalog = new Map();
        materialRows.forEach((item) => {
            const keys = [item.codigo, item.nombre].filter(Boolean).map(normalizedLookup);
            keys.forEach((key) => { if (key) materialCatalog.set(key, item); });
        });
        const troquelCatalog = new Map();
        troquelRows.forEach((item) => {
            const keys = [item.codigo, item.descripcion, item.descripcion_cotizaciones].filter(Boolean).map(normalizedLookup);
            keys.forEach((key) => { if (key) troquelCatalog.set(key, item); });
        });
        const machineCatalog = new Map();
        machineRows.forEach((item) => {
            const keys = [item.nombre, item.codigo, item.marca, item.modelo].filter(Boolean).map(normalizedLookup);
            keys.forEach((key) => { if (key) machineCatalog.set(key, item); });
        });

        routesResult.rows.forEach((row) => {
            const raw = row.raw_data || {};
            const lineSnapshot = raw.line_snapshot || {};
            const lineSummary = raw.line_summary || {};
            const snapshotRaw = lineSnapshot.raw_data || {};
            const uiState = snapshotRaw.CODEX_UI_STATE || lineSnapshot.uiState || {};
            const headerState = uiState.header || {};
            const processKey = normalizePlanningKey(row.process_name);
            const materialCode = row.material_code || lineSnapshot.materialCode || snapshotRaw['GENERAL | MATERIAL'] || '';
            const dieCode = row.die_code || lineSnapshot.dieCode || snapshotRaw['GENERAL | TROQUEL | ID'] || '';
            const machineName = row.machine_name || lineSummary.machine_name || lineSnapshot.quotedMachine || snapshotRaw['CONV | MAQUINA'] || '';
            const materialName = lineSnapshot.materialName || lineSummary.material_name || snapshotRaw['GENERAL | MATERIAL'] || '';
            const tintCount = Number(lineSnapshot.tintCount || lineSnapshot.pantoneCount || snapshotRaw['CANTIDAD TINTAS'] || 0);
            const attachments = Array.isArray(raw.attachments) ? raw.attachments : [];
            const additional = Array.isArray(uiState.additional) ? uiState.additional : [];
            const finishRows = Array.isArray(uiState.finishes) ? uiState.finishes : [];
            const missingItems = [];
            const readyItems = [];
            const materialRecord = materialCatalog.get(normalizedLookup(materialCode)) || materialCatalog.get(normalizedLookup(materialName)) || null;
            const troquelRecord = troquelCatalog.get(normalizedLookup(dieCode)) || null;
            const machineRecord = machineCatalog.get(normalizedLookup(machineName)) || null;

            const machineRequired = !['preprensa', 'diseno'].includes(processKey);
            const materialRequired = ['impresion', 'barnizado', 'laminado', 'rebobinado', 'empaque'].includes(processKey);
            const dieRequired = ['preprensa', 'impresion', 'troquelado', 'estampado', 'embosado'].includes(processKey);
            const tintRequired = processKey === 'impresion';
            const accessoryRequired = ['estampado', 'embosado'].includes(processKey);

            if (machineRequired) {
                if (!hasValue(machineName)) missingItems.push('Máquina');
                else if (!machineRecord) missingItems.push('Máquina no registrada');
                else readyItems.push('Máquina');
            }

            if (materialRequired) {
                if (!hasValue(materialCode) && !hasValue(materialName)) missingItems.push('Sustrato');
                else if (!materialRecord) missingItems.push('Sustrato no registrado');
                else readyItems.push('Sustrato');
            }

            if (dieRequired) {
                if (!hasValue(dieCode)) missingItems.push('Troquel / plancha');
                else if (!troquelRecord) missingItems.push('Troquel / plancha no registrado');
                else readyItems.push('Troquel / plancha');
            }

            if (tintRequired) {
                if (tintCount > 0) readyItems.push('Tintas');
                else missingItems.push('Tintas');
            }

            if (accessoryRequired) {
                const hasAccessory = additional.length > 0
                    || attachments.length > 0
                    || finishRows.some((finish) => String(finish.slotKey || '').trim().length > 0);
                if (hasAccessory) readyItems.push('Accesorios');
                else missingItems.push('Accesorios');
            }

            if (!grouped.has(row.order_code)) {
                grouped.set(row.order_code, {
                    orderCode: row.order_code,
                    customerName: row.customer_name || '',
                    jobName: row.job_name || lineSnapshot.jobName || '',
                    quantityProducts: Number(lineSnapshot.quantityProducts || raw.totals?.quantity || 0),
                    materialCode: materialCode || materialName || '',
                    dieCode,
                    salespersonName: raw.salesperson_name || lineSnapshot.salespersonName || headerState.salespersonName || '',
                    processes: []
                });
            }
            grouped.get(row.order_code).processes.push({
                routeId: row.id,
                processName: row.process_name,
                routeStatus: row.route_status,
                machineName,
                materialReady: materialRequired ? hasValue(materialCode) : true,
                dieReady: dieRequired ? hasValue(dieCode) : true,
                accessoriesReady: accessoryRequired ? missingItems.includes('Accesorios') === false : true,
                tintReady: tintRequired ? tintCount > 0 : true,
                missingItems,
                readyItems,
                tintCount,
                materialLabel: materialCode || materialName || '',
                materialRegistered: Boolean(materialRecord),
                materialCatalogName: materialRecord?.nombre || '',
                dieLabel: dieCode || '',
                dieRegistered: Boolean(troquelRecord),
                dieCatalogName: troquelRecord?.descripcion || troquelRecord?.descripcion_cotizaciones || '',
                machineLabel: machineName || '',
                machineRegistered: Boolean(machineRecord),
                attachmentCount: attachments.length,
                additionalCount: additional.length,
                raw: row.raw_data
            });
        });

        res.json({ ok: true, items: Array.from(grouped.values()) });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'No fue posible cargar el preturno.' });
    }
});

app.get('/api/planificacion/resumen', async (req, res) => {
    try {
        await ensurePlanningRoutesForLiveOrders();
        const [orders, routes, events, waste] = await Promise.all([
            pgQuery(`SELECT COUNT(*)::int AS total FROM flexo_orders WHERE delivered_on IS NULL`),
            pgQuery(`SELECT COUNT(*)::int AS total FROM production_order_routes`),
            pgQuery(`SELECT COUNT(*)::int AS total FROM production_route_events WHERE created_at::date = CURRENT_DATE`),
            pgQuery(`SELECT COALESCE(SUM(useful_feet),0)::numeric AS useful_feet FROM production_waste_logs WHERE created_at::date = CURRENT_DATE`)
        ]);
        res.json({
            ok: true,
            data: {
                liveOrders: orders.rows[0]?.total || 0,
                activeRoutes: routes.rows[0]?.total || 0,
                dayEvents: events.rows[0]?.total || 0,
                usefulFeetToday: Number(waste.rows[0]?.useful_feet || 0)
            }
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'No fue posible cargar el resumen de planificación.' });
    }
});

app.get('/api/mes/motivos-paro', async (req, res) => {
    try {
        const result = await pgQuery(`
            SELECT id, reason_group, reason_code, description
            FROM production_stop_reasons
            WHERE is_active = TRUE
            ORDER BY reason_group, description
        `);
        res.json({ ok: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'No fue posible cargar los motivos de paro.' });
    }
});

app.get('/api/mes/contexto', async (req, res) => {
    try {
        await ensurePlanningRoutesForLiveOrders();
        const area = String(req.query.area || 'operario').trim().toLowerCase();
        const routeId = String(req.query.routeId || '').trim();
        const orderCode = String(req.query.orderCode || '').trim();
        const plateKeys = ['planchas', 'preprensa', 'diseno'];
        const targetPlateArea = area === 'planchas';
        const productionPriority = ['impresion', 'barnizado', 'laminado', 'estampado', 'embosado', 'troquelado', 'rebobinado', 'empaque'];
        const platePriority = ['preprensa', 'planchas', 'diseno'];
        const filters = [];
        const values = [];

        if (routeId) {
            values.push(routeId);
            filters.push(`r.id = $${values.length}::uuid`);
        } else if (orderCode) {
            values.push(orderCode);
            filters.push(`r.order_code = $${values.length}`);
        }

        if (targetPlateArea) {
            values.push(plateKeys);
            filters.push(`r.process_key = ANY($${values.length}::text[])`);
        } else {
            values.push(plateKeys);
            filters.push(`NOT (r.process_key = ANY($${values.length}::text[]))`);
        }

        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
        const priorityList = targetPlateArea ? platePriority : productionPriority;
        const priorityCase = priorityList
            .map((key, index) => `WHEN '${key}' THEN ${index}`)
            .join(' ');
        const routeResult = await pgQuery(`
            SELECT
                r.id::text AS route_id,
                r.order_code,
                r.quote_code,
                r.line_code,
                r.process_key,
                r.process_name,
                r.route_status,
                r.sequence_order,
                r.transition_cost_min,
                r.start_turn_hour,
                r.duration_hours,
                r.actual_start_at,
                r.actual_end_at,
                mp.id::text AS machine_profile_id,
                mp.machine_name,
                mp.nominal_speed_fpm,
                mp.oee_target,
                mp.setup_minutes,
                mp.hourly_machine_cost,
                mp.hourly_operator_cost,
                o.material_code,
                o.die_code,
                o.ordered_quantity,
                o.machine_name AS quoted_machine_name,
                o.raw_data,
                o.created_at AS order_created_at
            FROM production_order_routes r
            JOIN flexo_orders o ON o.order_code = r.order_code
            LEFT JOIN production_machine_profiles mp ON mp.id = r.machine_profile_id
            ${whereClause}
            ORDER BY
                CASE lower(coalesce(r.process_key, ''))
                    ${priorityCase}
                    ELSE 99
                END,
                CASE
                    WHEN coalesce(mp.machine_name, '') <> '' OR coalesce(o.machine_name, '') <> '' THEN 0
                    ELSE 1
                END,
                CASE r.route_status
                    WHEN 'RUN' THEN 0
                    WHEN 'SETUP' THEN 1
                    WHEN 'PARO' THEN 2
                    WHEN 'PENDIENTE' THEN 3
                    WHEN 'COMPLETADO' THEN 4
                    ELSE 5
                END,
                r.updated_at DESC,
                r.order_code,
                r.sequence_order
            LIMIT 1
        `, values);

        const route = routeResult.rows[0];
        if (!route) {
            return res.status(404).json({ ok: false, error: 'No se encontró una ruta activa para el MES solicitado.' });
        }

        const [eventsResult, wasteResult] = await Promise.all([
            pgQuery(`
                SELECT
                    e.id::text AS id,
                    e.route_id::text AS route_id,
                    e.operator_name,
                    e.event_type,
                    e.notes,
                    e.created_at,
                    sr.id::text AS stop_reason_id,
                    sr.reason_group,
                    sr.reason_code,
                    sr.description AS stop_reason_description
                FROM production_route_events e
                LEFT JOIN production_stop_reasons sr ON sr.id = e.stop_reason_id
                WHERE e.route_id = $1::uuid
                ORDER BY e.created_at DESC
                LIMIT 50
            `, [route.route_id]),
            pgQuery(`
                SELECT
                    id::text AS id,
                    route_id::text AS route_id,
                    feet_consumed,
                    setup_waste_feet,
                    run_waste_feet,
                    useful_feet,
                    final_speed_fpm,
                    anilox_line,
                    cylinder_pressure,
                    notes,
                    created_at
                FROM production_waste_logs
                WHERE route_id = $1::uuid
                ORDER BY created_at DESC
                LIMIT 1
            `, [route.route_id])
        ]);

        const raw = route.raw_data || {};
        const lineSummary = raw.line_summary || {};
        const lineSnapshot = raw.line_snapshot || {};
        const customerName = raw.customer_name || '';
        const productName = lineSummary.job_name || lineSummary.product_name || route.order_code;
        const tintCount = Number(lineSnapshot.pantoneCount || lineSnapshot.tintCount || 0);
        const materialFeet = Number(lineSnapshot.materialFeet || route.ordered_quantity || 0);

        const firstSetup = eventsResult.rows.find((event) => String(event.event_type || '').toLowerCase() === 'setup');
        const firstRun = eventsResult.rows.find((event) => String(event.event_type || '').toLowerCase() === 'run');
        const firstCompleted = eventsResult.rows.find((event) => String(event.event_type || '').toLowerCase() === 'completado');

        res.json({
            ok: true,
            data: {
                routeId: route.route_id,
                orderCode: route.order_code,
                quoteCode: route.quote_code || '',
                lineCode: route.line_code || '',
                processKey: route.process_key,
                processName: route.process_name,
                routeStatus: route.route_status,
                sequenceOrder: route.sequence_order,
                customerName,
                productName,
                tintCount,
                plannedFeet: materialFeet,
                materialCode: route.material_code || '',
                dieCode: route.die_code || '',
                machineName: route.machine_name || route.quoted_machine_name || '',
                nominalSpeedFpm: Number(route.nominal_speed_fpm || 0),
                oeeTarget: Number(route.oee_target || 0),
                setupMinutes: Number(route.setup_minutes || 0),
                hourlyMachineCost: Number(route.hourly_machine_cost || 0),
                hourlyOperatorCost: Number(route.hourly_operator_cost || 0),
                createdAt: route.order_created_at,
                requestedAt: raw.requested_at || raw.updated_at || route.order_created_at,
                events: eventsResult.rows,
                latestWaste: wasteResult.rows[0] || null,
                timestamps: {
                    setupAt: firstSetup?.created_at || null,
                    runAt: firstRun?.created_at || null,
                    completedAt: firstCompleted?.created_at || route.actual_end_at || null
                },
                raw
            }
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'No fue posible cargar el contexto MES.' });
    }
});

app.get('/api/planificacion/dashboard-kpi', async (req, res) => {
    try {
        await ensurePlanningRoutesForLiveOrders();
        const [summaryResult, machineResult, varianceResult, stopResult] = await Promise.all([
            pgQuery(`
                WITH live_routes AS (
                    SELECT *
                    FROM production_order_routes
                ),
                waste AS (
                    SELECT
                        SUM(feet_consumed) AS feet_consumed,
                        SUM(useful_feet) AS useful_feet
                    FROM production_waste_logs
                )
                SELECT
                    COUNT(*)::int AS total_routes,
                    COUNT(*) FILTER (WHERE route_status = 'COMPLETADO')::int AS completed_routes,
                    COUNT(*) FILTER (WHERE route_status = 'RUN')::int AS running_routes,
                    COUNT(*) FILTER (WHERE route_status = 'PARO')::int AS stopped_routes,
                    COALESCE((SELECT feet_consumed FROM waste), 0) AS feet_consumed,
                    COALESCE((SELECT useful_feet FROM waste), 0) AS useful_feet
                FROM live_routes
            `),
            pgQuery(`
                WITH machine_base AS (
                    SELECT
                        mp.id,
                        mp.machine_name,
                        mp.nominal_speed_fpm,
                        COUNT(r.id) AS total_routes,
                        COUNT(*) FILTER (WHERE r.route_status = 'RUN') AS running_routes,
                        COUNT(*) FILTER (WHERE r.route_status = 'PARO') AS stopped_routes,
                        COUNT(*) FILTER (WHERE r.route_status = 'COMPLETADO') AS completed_routes,
                        AVG(CASE
                            WHEN COALESCE(w.final_speed_fpm, 0) > 0 AND COALESCE(mp.nominal_speed_fpm, 0) > 0
                                THEN LEAST(1, w.final_speed_fpm / NULLIF(mp.nominal_speed_fpm, 0))
                            ELSE NULL
                        END) AS performance_ratio,
                        SUM(COALESCE(w.feet_consumed, 0)) AS feet_consumed,
                        SUM(COALESCE(w.useful_feet, 0)) AS useful_feet
                    FROM production_machine_profiles mp
                    LEFT JOIN production_order_routes r ON r.machine_profile_id = mp.id
                    LEFT JOIN LATERAL (
                        SELECT *
                        FROM production_waste_logs w
                        WHERE w.route_id = r.id
                        ORDER BY w.created_at DESC
                        LIMIT 1
                    ) w ON TRUE
                    WHERE mp.is_active = TRUE
                    GROUP BY mp.id, mp.machine_name, mp.nominal_speed_fpm
                )
                SELECT
                    id::text AS machine_id,
                    machine_name,
                    total_routes,
                    running_routes,
                    stopped_routes,
                    completed_routes,
                    ROUND(
                        GREATEST(
                            0,
                            CASE
                                WHEN total_routes > 0 THEN 1 - (stopped_routes::numeric / total_routes::numeric)
                                ELSE 0.85
                            END
                        ) * 100, 2
                    ) AS availability_pct,
                    ROUND(COALESCE(performance_ratio, 0.8) * 100, 2) AS performance_pct,
                    ROUND(
                        CASE
                            WHEN COALESCE(feet_consumed, 0) > 0 THEN (useful_feet / NULLIF(feet_consumed, 0)) * 100
                            ELSE 95
                        END
                    , 2) AS quality_pct
                FROM machine_base
                ORDER BY machine_name
            `),
            pgQuery(`
                SELECT
                    process_name,
                    ROUND(AVG(COALESCE(duration_hours, 0) * 60), 2) AS plan_minutes,
                    ROUND(AVG(
                        CASE
                            WHEN actual_start_at IS NOT NULL AND actual_end_at IS NOT NULL
                                THEN EXTRACT(EPOCH FROM (actual_end_at - actual_start_at)) / 60
                            ELSE NULL
                        END
                    ), 2) AS real_minutes
                FROM production_order_routes
                GROUP BY process_name
                ORDER BY process_name
            `),
            pgQuery(`
                SELECT
                    COALESCE(sr.reason_group, 'Sin grupo') AS reason_group,
                    COALESCE(sr.description, 'Sin motivo') AS reason_description,
                    COUNT(*)::int AS total
                FROM production_route_events e
                LEFT JOIN production_stop_reasons sr ON sr.id = e.stop_reason_id
                WHERE lower(COALESCE(e.event_type, '')) = 'paro'
                GROUP BY COALESCE(sr.reason_group, 'Sin grupo'), COALESCE(sr.description, 'Sin motivo')
                ORDER BY total DESC, reason_group, reason_description
                LIMIT 12
            `)
        ]);

        const summary = summaryResult.rows[0] || {};
        const machineMetrics = (machineResult.rows || []).map((row) => {
            const availability = Number(row.availability_pct || 0);
            const performance = Number(row.performance_pct || 0);
            const quality = Number(row.quality_pct || 0);
            const oee = Number(((availability * performance * quality) / 10000).toFixed(2));
            return {
                machineId: row.machine_id,
                machineName: row.machine_name,
                totalRoutes: Number(row.total_routes || 0),
                runningRoutes: Number(row.running_routes || 0),
                stoppedRoutes: Number(row.stopped_routes || 0),
                completedRoutes: Number(row.completed_routes || 0),
                availabilityPct: availability,
                performancePct: performance,
                qualityPct: quality,
                oeePct: oee
            };
        });

        const average = (items, key, fallback = 0) => {
            if (!items.length) return fallback;
            return Number((items.reduce((acc, item) => acc + Number(item[key] || 0), 0) / items.length).toFixed(2));
        };

        const deliveredOnTime = Number(summary.completed_routes || 0);
        const delayedRoutes = Number(summary.stopped_routes || 0);
        const qualityGlobal = Number(
            Number(summary.feet_consumed || 0) > 0
                ? ((Number(summary.useful_feet || 0) / Number(summary.feet_consumed || 0)) * 100).toFixed(2)
                : 95
        );

        res.json({
            ok: true,
            data: {
                summary: {
                    totalRoutes: Number(summary.total_routes || 0),
                    completedRoutes: deliveredOnTime,
                    runningRoutes: Number(summary.running_routes || 0),
                    stoppedRoutes: delayedRoutes,
                    oeeAverage: average(machineMetrics, 'oeePct', 0),
                    availabilityAverage: average(machineMetrics, 'availabilityPct', 0),
                    performanceAverage: average(machineMetrics, 'performancePct', 0),
                    qualityAverage: qualityGlobal
                },
                machines: machineMetrics,
                otd: {
                    deliveredOnTime,
                    delayedRoutes,
                    weeklyOtdPct: Number(
                        (deliveredOnTime + delayedRoutes) > 0
                            ? ((deliveredOnTime / (deliveredOnTime + delayedRoutes)) * 100).toFixed(2)
                            : 0
                    ),
                    delayedItems: machineMetrics
                        .filter((item) => item.stoppedRoutes > 0)
                        .slice(0, 6)
                        .map((item) => ({
                            code: item.machineName,
                            customer: 'Planificación',
                            delay: `+${item.stoppedRoutes}`,
                            cause: 'Paros activos en rutas'
                        }))
                },
                variance: (varianceResult.rows || [])
                    .filter((row) => Number(row.plan_minutes || 0) > 0 || Number(row.real_minutes || 0) > 0)
                    .map((row) => ({
                        processName: row.process_name,
                        planMinutes: Number(row.plan_minutes || 0),
                        realMinutes: Number(row.real_minutes || 0),
                        variancePct: Number(row.plan_minutes || 0) > 0
                            ? Number((((Number(row.real_minutes || 0) - Number(row.plan_minutes || 0)) / Number(row.plan_minutes || 0)) * 100).toFixed(2))
                            : 0
                    })),
                stops: (stopResult.rows || []).map((row) => ({
                    group: row.reason_group,
                    reason: row.reason_description,
                    total: Number(row.total || 0)
                }))
            }
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'No fue posible cargar el dashboard KPI.' });
    }
});

app.post('/api/mes/evento', async (req, res) => {
    try {
        const { routeId, operatorName, eventType, stopReasonId, notes } = req.body || {};
        if (!routeId || !eventType) {
            return res.status(400).json({ ok: false, error: 'Debes indicar routeId y eventType.' });
        }

        await pgQuery(`
            INSERT INTO production_route_events (
                route_id, operator_name, event_type, stop_reason_id, notes
            ) VALUES ($1,$2,$3,$4,$5)
        `, [routeId, operatorName || null, eventType, stopReasonId || null, notes || null]);

        const statusMap = {
            setup: 'SETUP',
            run: 'RUN',
            paro: 'PARO',
            completado: 'COMPLETADO'
        };
        const nextStatus = statusMap[String(eventType).trim().toLowerCase()];
        if (nextStatus) {
            const timestampField = nextStatus === 'RUN'
                ? 'actual_start_at'
                : nextStatus === 'COMPLETADO'
                    ? 'actual_end_at'
                    : null;
            if (timestampField) {
                await pgQuery(`
                    UPDATE production_order_routes
                    SET route_status = $1,
                        ${timestampField} = COALESCE(${timestampField}, NOW()),
                        updated_at = NOW()
                    WHERE id = $2
                `, [nextStatus, routeId]);
            } else {
                await pgQuery(`
                    UPDATE production_order_routes
                    SET route_status = $1,
                        updated_at = NOW()
                    WHERE id = $2
                `, [nextStatus, routeId]);
            }
        }

        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'No fue posible guardar el evento MES.' });
    }
});

app.post('/api/mes/mermas', async (req, res) => {
    try {
        const {
            routeId,
            feetConsumed,
            setupWasteFeet,
            runWasteFeet,
            finalSpeedFpm,
            aniloxLine,
            cylinderPressure,
            notes
        } = req.body || {};
        if (!routeId) {
            return res.status(400).json({ ok: false, error: 'Debes indicar routeId.' });
        }
        await pgQuery(`
            INSERT INTO production_waste_logs (
                route_id, feet_consumed, setup_waste_feet, run_waste_feet,
                final_speed_fpm, anilox_line, cylinder_pressure, notes
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `, [
            routeId,
            Number(feetConsumed || 0),
            Number(setupWasteFeet || 0),
            Number(runWasteFeet || 0),
            Number(finalSpeedFpm || 0),
            aniloxLine || null,
            cylinderPressure || null,
            notes || null
        ]);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'No fue posible guardar la declaración de merma.' });
    }
});

app.get('/api/flexo/calculo', async (req, res) => {
    try {
        const quoteId = String(req.query.quoteId || '').trim();
        const lineId = String(req.query.lineId || '').trim();

        if (!quoteId && !lineId) {
            return res.status(400).json({ error: 'Debes indicar quoteId o lineId.' });
        }

        const where = [];
        const values = [];

        if (quoteId) {
            values.push(quoteId);
            where.push(`quote_code = $${values.length}`);
        }

        if (lineId) {
            values.push(lineId);
            where.push(`line_code = $${values.length}`);
        }

        const currentResult = await pgQuery(
            `SELECT calculation_code, quote_code, line_code, product_code, customer_code, process_type, machine_name, die_code, material_code,
                    quantity, subtotal_cost, total_cost, unit_price, raw_data
               FROM flexo_calculations
              WHERE ${where.join(' AND ')}
              ORDER BY quote_code DESC, line_code NULLS LAST
              LIMIT 1`,
            values
        );

        if (!currentResult.rows.length) {
            return res.status(404).json({ error: 'Cálculo flexográfico no encontrado.' });
        }

        const current = currentResult.rows[0];
        const detail = mapFlexoCalculationDetail(current);
        const lineResult = await pgQuery(
            `SELECT calculation_code, quote_code, line_code, product_code, customer_code, process_type, machine_name, die_code, material_code,
                    quantity, subtotal_cost, total_cost, unit_price, raw_data
               FROM (
                    SELECT DISTINCT ON (line_code)
                           calculation_code, quote_code, line_code, product_code, customer_code, process_type, machine_name, die_code, material_code,
                           quantity, subtotal_cost, total_cost, unit_price, raw_data, created_at
                      FROM flexo_calculations
                     WHERE quote_code = $1
                     ORDER BY line_code NULLS LAST, created_at DESC NULLS LAST, calculation_code DESC NULLS LAST
               ) latest_lines
              ORDER BY
                    CASE
                        WHEN COALESCE(latest_lines.raw_data->>'CODEX_LINE_ORDER', '') ~ '^[0-9]+$'
                            THEN (latest_lines.raw_data->>'CODEX_LINE_ORDER')::integer
                        ELSE NULL
                    END NULLS LAST,
                    line_code NULLS LAST`,
            [current.quote_code]
        );
        const quoteResult = await pgQuery(
            `SELECT quote_code, customer_code, customer_name, contact_name, email, salesperson_name, phone, status, created_on, due_on, raw_data
               FROM quotes
              WHERE quote_code = $1`,
            [current.quote_code]
        );

        res.json({
            calculo: detail,
            cotizacion: quoteResult.rows.length
                ? mapQuoteHeader(quoteResult.rows[0])
                : {
                    quote_code: detail.quoteCode,
                    customer_code: detail.customerCode,
                    customer_name: detail.customerName,
                    salesperson_name: detail.salespersonName,
                    status: detail.lineStatus,
                    created_on: detail.raw_data?.['FECHA CREACION'] || '',
                    due_on: detail.raw_data?.['FECHA VENCIMIENTO'] || '',
                    raw_data: detail.raw_data
                },
            lineasRelacionadas: lineResult.rows.map(mapCalculationLine)
        });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible cargar el cálculo flexográfico.' });
    }
});

app.get('/api/flexo/catalogos', async (req, res) => {
    try {
        res.json(await loadFlexoCatalogsFromDb());
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible cargar los catálogos de flexografía.' });
    }
});

app.get('/api/flexo/notificaciones', async (req, res) => {
    try {
        const quoteCode = pickFirstValue(req.query.quoteCode, req.query.quote_code);
        const lineCode = pickFirstValue(req.query.lineCode, req.query.line_code);
        if (!quoteCode || !lineCode) {
            return res.status(400).json({ error: 'Debes indicar quoteCode y lineCode.' });
        }
        const result = await pgQuery(
            `SELECT id, quote_code, line_code, seller_name, customer_name, job_name, issue_text, target_user, created_by, snapshot, created_at
               FROM quote_line_notifications
              WHERE quote_code = $1 AND line_code = $2
              ORDER BY created_at DESC`,
            [quoteCode, lineCode]
        );
        res.json({
            items: result.rows.map((row) => ({
                id: row.id,
                quoteCode: row.quote_code,
                lineCode: row.line_code,
                sellerName: row.seller_name,
                customerName: row.customer_name,
                jobName: row.job_name,
                issueText: row.issue_text,
                targetUser: row.target_user,
                createdBy: row.created_by,
                snapshot: row.snapshot || {},
                createdAt: row.created_at
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible cargar las notificaciones.' });
    }
});

app.post('/api/flexo/notificaciones', async (req, res) => {
    try {
        const payload = req.body || {};
        const quoteCode = pickFirstValue(payload.quoteCode, payload.quote_code);
        const lineCode = pickFirstValue(payload.lineCode, payload.line_code);
        const issueText = String(payload.issueText || payload.issue_text || '').trim();
        if (!quoteCode || !lineCode || !issueText) {
            return res.status(400).json({ error: 'Debes indicar quoteCode, lineCode y el problema detectado.' });
        }
        const result = await pgQuery(
            `INSERT INTO quote_line_notifications (
                quote_code, line_code, seller_name, customer_name, job_name, issue_text, target_user, created_by, snapshot
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
             RETURNING id, created_at`,
            [
                quoteCode,
                lineCode,
                pickFirstValue(payload.sellerName, payload.seller_name),
                pickFirstValue(payload.customerName, payload.customer_name),
                pickFirstValue(payload.jobName, payload.job_name),
                issueText,
                pickFirstValue(payload.targetUser, payload.target_user),
                pickFirstValue(payload.actor, getConfiguredCurrentUser()),
                JSON.stringify(payload.snapshot || {})
            ]
        );
        res.json({ ok: true, id: result.rows[0]?.id, createdAt: result.rows[0]?.created_at });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible guardar la notificación.' });
    }
});

app.post('/api/flexo/calculo/guardar', async (req, res) => {
    try {
        const payload = req.body || {};
        const quoteCode = pickFirstValue(payload.quoteCode, payload.quote_code);
        const currentLineCode = pickFirstValue(payload.originalLineCode, payload.lineCode, payload.line_code);
        if (!quoteCode || !currentLineCode) {
            return res.status(400).json({ error: 'Debes indicar quoteCode y lineCode.' });
        }

        const existing = await pgQuery(
            `SELECT calculation_code, raw_data
               FROM flexo_calculations
              WHERE quote_code = $1 AND line_code = $2
              ORDER BY created_at DESC NULLS LAST
              LIMIT 1`,
            [quoteCode, currentLineCode]
        );

        if (!existing.rows.length) {
            return res.status(404).json({ error: 'No se encontró la línea a guardar.' });
        }

        const lineCode = pickFirstValue(payload.lineCode, payload.line_code, currentLineCode);
        const machineName = await resolveSingleInventoryMachineName(payload.machineName);
        const rawData = buildCalculationRawData({
            quote_code: quoteCode,
            line_code: lineCode,
            customer_code: payload.customerCode,
            customer_name: payload.customerName,
            salesperson_name: payload.salespersonName,
            process_type: payload.processType,
            material_code: payload.materialId,
            material_name: payload.materialName,
            die_code: payload.dieId,
            machine_name: machineName,
            quantityProducts: payload.quantityProducts,
            quantityTypes: payload.quantityTypes,
            quantityChanges: payload.quantityChanges,
            widthInches: payload.widthInches,
            lengthInches: payload.lengthInches,
            stationCount: payload.stationCount,
            labelsPerRoll: payload.labelsPerRoll,
            coreWidth: payload.uiState?.coreWidth ?? payload.coreWidth,
            coreDiameter: payload.uiState?.coreDiameter ?? payload.coreDiameter,
            applicationType: payload.applicationType,
            outputType: payload.outputType,
            cmyk: payload.cmyk,
            uiState: payload.uiState,
            total_cost: payload.finalTotal,
            unit_price: payload.unitPrice,
            status: payload.lineStatus,
            job_name: payload.jobName,
            department: payload.department
        }, existing.rows[0].raw_data || {});
        applyCurrencyFieldsToRawData(rawData, payload.exchangeRate ?? payload.exchange_rate);
        if (Object.prototype.hasOwnProperty.call(payload, 'finalized_for_order') || Object.prototype.hasOwnProperty.call(payload, 'finalizedForOrder')) {
            rawData['CODEX_FINALIZED_FOR_ORDER'] = Boolean(Object.prototype.hasOwnProperty.call(payload, 'finalized_for_order')
                ? payload.finalized_for_order
                : payload.finalizedForOrder);
        }

        await pgQuery(
            `UPDATE flexo_calculations
                SET line_code = $3,
                    process_type = $4,
                    machine_name = $5,
                    die_code = $6,
                    material_code = $7,
                    quantity = $8,
                    total_cost = $9,
                    unit_price = $10,
                    raw_data = $11::jsonb
              WHERE calculation_code = $1 AND quote_code = $2`,
            [
                existing.rows[0].calculation_code,
                quoteCode,
                lineCode,
                pickFirstValue(payload.processType, 'Convencional'),
                machineName || null,
                pickFirstValue(payload.dieId),
                pickFirstValue(payload.materialId),
                parseLegacyNumber(payload.quantityProducts),
                parseLegacyNumber(payload.finalTotal),
                parseLegacyNumber(payload.unitPrice),
                JSON.stringify(rawData)
            ]
        );

        const detail = await pgQuery(
            `SELECT calculation_code, quote_code, line_code, product_code, customer_code, process_type, machine_name, die_code, material_code,
                    quantity, subtotal_cost, total_cost, unit_price, raw_data
               FROM flexo_calculations
              WHERE calculation_code = $1`,
            [existing.rows[0].calculation_code]
        );
        res.json({ calculo: mapFlexoCalculationDetail(detail.rows[0]) });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible guardar el cálculo.' });
    }
});

app.get('/api/inventario/:kind', async (req, res) => {
    try {
        const items = await listInventory(req.params.kind, {
            q: req.query.q || '',
            limit: req.query.limit || 300
        });
        res.json({ items, total: items.length });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible cargar el inventario.' });
    }
});

app.get('/api/inventario/troqueles/:codigo', async (req, res) => {
    try {
        const item = await getTroquelByCode(req.params.codigo);
        if (!item) {
            return res.status(404).json({ error: 'Troquel no encontrado.' });
        }
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible cargar el troquel.' });
    }
});

app.post('/api/inventario/:kind', async (req, res) => {
    try {
        const id = await saveInventory(req.params.kind, req.body || {});
        const items = await listInventory(req.params.kind, { limit: 5000 });
        const record = items.find((item) => item.id === id) || null;
        res.json({ ok: true, id, item: record });
    } catch (error) {
        res.status(400).json({ error: error.message || 'No fue posible guardar el registro.' });
    }
});

app.post('/api/inventario/:kind/import', async (req, res) => {
    try {
        const base64 = String(req.body?.contentBase64 || '').trim();
        if (!base64) {
            throw new Error('No se recibió el archivo a importar.');
        }
        const buffer = Buffer.from(base64, 'base64');
        const result = await importInventory(req.params.kind, buffer);
        res.json({ ok: true, ...result });
    } catch (error) {
        res.status(400).json({ error: error.message || 'No fue posible importar el inventario.' });
    }
});

app.get('/api/inventario/:kind/export', async (req, res) => {
    try {
        const buffer = await exportInventoryWorkbook(req.params.kind);
        const safeKind = String(req.params.kind || 'inventario').replace(/[^a-z0-9_-]+/gi, '-');
        const fileName = `${safeKind}-${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible exportar el inventario.' });
    }
});

app.get('/api/catalogs', async (req, res) => {
    try {
        const helpers = await loadErpImpresionHelpers();
        const catalogs = await helpers.loadWebCatalogs();
        const materialRows = await listInventory('materiales', { limit: 5000 });
        const machineRows = await listInventory('maquinas', { limit: 5000 });
        const troquelRows = await listInventory('troqueles', { limit: 5000 });
        const processes = await listInventory('procesos', { limit: 2000 });
        const outputTypes = await listInventory('tipos-salida', { limit: 500 });
        const materials = materialRows.map((item) => ({
            id: item.id,
            codigo: item.codigo,
            code: item.codigo,
            nombre: item.nombre,
            name: item.nombre,
            descripcion: item.nombre,
            description: item.nombre,
            ancho_mm: item.ancho_mm,
            widthMm: item.ancho_mm,
            largo_mm: item.largo_mm,
            lengthMm: item.largo_mm,
            gramaje_g_m2: item.gramaje_g_m2,
            gramaje: item.gramaje_g_m2,
            calibre_micras: item.calibre_micras,
            costo_x_lamina: item.costo_x_lamina,
            costoPorLamina: item.costo_x_lamina,
            costo_x_msi: item.costo_x_msi,
            costoMaterialPorMsi: item.costo_x_msi,
            costo_x_m2: item.costo_x_m2,
            costo_x_ft2: item.costo_x_m2 ? Number(item.costo_x_m2) / FT2_PER_M2 : 0,
            costo_x_kg: item.costo_x_kg,
            costo_x_libra: item.costo_x_libra,
            costoPorLibra: item.costo_x_libra,
            peso_capa_gsm: item.peso_capa_gsm,
            gsm: item.peso_capa_gsm,
            familia_proceso: item.familia_proceso,
            familiaProceso: item.familia_proceso,
            costo_x_unidad: item.costo_x_unidad,
            merma_pct: item.merma_pct,
            rendimiento_g_ft2: item.rendimiento_g_ft2 || (item.peso_capa_gsm ? Number(item.peso_capa_gsm) / FT2_PER_M2 : 0),
            temperatura_aplicacion_c: item.temperatura_aplicacion_c,
            tipo_transferencia: item.tipo_transferencia,
            compatible_convencional: item.compatible_convencional,
            compatible_digital: item.compatible_digital,
            tipo_proforma: item.tipo_proforma,
            familia: item.familia_proceso || item.tipo_proforma,
            activo: item.activo,
            active: item.activo
        }));
        const machines = machineRows.map((item) => {
            const capacities = Array.isArray(item.capacidades) ? item.capacidades : [];
            const primary = capacities.find((entry) => entry && entry.activa !== false) || capacities[0] || null;
            return {
                id: item.id,
                nombre: item.nombre,
                name: item.nombre,
                machineName: item.nombre,
                marca: item.marca || '',
                modelo: item.modelo || '',
                tipo: item.tipo,
                type: item.tipo,
                speedUnit: item.unidad_velocidad_produccion || 'ft/min',
                activa: item.activa,
                active: item.activa,
                observaciones: item.observaciones,
                category: primary?.clasificacion || '',
                clasificacion: primary?.clasificacion || '',
                process: primary?.proceso || '',
                proceso: primary?.proceso || '',
                subprocess: primary?.subproceso || '',
                subproceso: primary?.subproceso || '',
                setupBaseMinutes: primary?.tiempo_preparacion_general ?? 0,
                setupPerStationMinutes: primary?.tiempo_por_estacion ?? item.factor_montaje_estacion ?? 0,
                anchoMaxIn: primary?.ancho_max_in ?? item.ancho_max_in ?? 0,
                ancho_max_in: primary?.ancho_max_in ?? item.ancho_max_in ?? 0,
                productionSpeed: primary?.velocidad_produccion ?? 0,
                unidad_velocidad_produccion: item.unidad_velocidad_produccion || 'ft/min',
                hourlyMachineCost: primary?.costo_hora_maquina ?? 0,
                hourlyOperatorCost: primary?.costo_hora_operario ?? 0,
                availableColors: /digital/i.test(String(item.tipo || '')) ? 0 : 8,
                capacities
            };
        });
        const machineCategories = machines.reduce((accumulator, machine) => {
            const key = String(machine.category || machine.process || 'general').toLowerCase();
            if (!accumulator[key]) accumulator[key] = [];
            accumulator[key].push(machine);
            return accumulator;
        }, {});
        const troqueles = troquelRows.map((item) => ({
            id: item.id,
            codigo: item.codigo,
            codigoTroquel: item.codigo,
            descripcion: item.descripcion,
            description: item.descripcion,
            descripcionCotizaciones: item.descripcion_cotizaciones,
            clasificacion: item.clasificacion,
            ancho_mm: item.ancho_mm,
            largo_mm: item.largo_mm,
            ancho_total_troquel_in: item.ancho_total_troquel_in,
            largo_total_troquel_in: item.largo_total_troquel_in,
            anchoEtiquetaIn: item.ancho_etiqueta_in,
            largoEtiquetaIn: item.largo_etiqueta_in,
            anchoEtiqueta: item.ancho_etiqueta_in,
            largoEtiqueta: item.largo_etiqueta_in,
            anchoTroquel: item.ancho_total_troquel_in,
            largoTroquel: item.largo_total_troquel_in,
            desarrolloIn: item.desarrollo_in,
            elongacionPct: item.elongacion_pct,
            elongacion_pct: item.elongacion_pct,
            filas: item.cantidad_filas,
            rows: item.cantidad_filas,
            dientes: item.dientes,
            teeth: item.dientes,
            repeticiones: item.repeticiones,
            repetitions: item.repeticiones,
            areaTroquel: item.area_troquel_in2,
            areaTroquelIn2: item.area_troquel_in2,
            imageUrl: item.image_url,
            image_url: item.image_url,
            activo: item.activo
        }));
        res.json({ ...catalogs, materials, machines, machineCategories, troqueles, processes, outputTypes });
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible cargar los catálogos integrados.' });
    }
});

app.get('/api/inventories', async (req, res) => {
    try {
        const helpers = await loadErpImpresionHelpers();
        const inventories = await helpers.loadInventoryViews();
        const processRows = await listInventory('procesos', { limit: 2000 });
        inventories.processes = {
            columns: ['codigo', 'nombre', 'categoria', 'machine_name', 'es_inline', 'costo_hora_maquina', 'costo_hora_operario'],
            rows: processRows
        };
        res.json(inventories);
    } catch (error) {
        res.status(500).json({ error: error.message || 'No fue posible cargar los inventarios integrados.' });
    }
});

app.post('/api/flexo-regular/calculate', async (req, res) => {
    try {
        const helpers = await loadErpImpresionHelpers();
        res.json(await helpers.calculateFlexoRegularFromRequest(req.body || {}));
    } catch (error) {
        res.status(400).json({ error: error.message || 'No fue posible calcular en el cotizador integrado.' });
    }
});

app.post('/api/cotizador-pro/preview', async (req, res) => {
    try {
        res.json(await calculateProcessQuote(req.body || {}));
    } catch (error) {
        res.status(400).json({ error: error.message || 'No fue posible calcular la cotización del cotizador Pro.' });
    }
});

app.post('/api/flexo/calcular-preview', async (req, res) => {
    try {
        const catalogs = await loadFlexoCatalogsFromDb();
        res.json(calculateFlexoPreview(req.body || {}, catalogs));
    } catch (error) {
        res.status(400).json({ error: error.message || 'No fue posible generar la vista previa del cálculo flexográfico.' });
    }
});

app.post('/api/cotizador/flexografia/calcular', (req, res) => {
    try {
        res.json(calcularCotizacionFlexografia(req.body || {}));
    } catch (error) {
        res.status(400).json({ error: error.message || 'No fue posible calcular la cotización.' });
    }
});

app.get('/flexo-calculo', (req, res) => {
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(`/calculo-flexografia${query}`);
});

app.get('/configuracion-general', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'configuracion-general.html'));
});

app.get('/proforma', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'proforma.html'));
});

app.get('/socios', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'socios.html'));
});

app.get('/socios/documento', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'socios-documento.html'));
});

app.get('/inventario-materiales', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'catalogo.html'));
});

app.get('/inventario-troqueles', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'inventario-troqueles.html'));
});

app.get('/inventario-troqueles/documento', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'troquel-documento.html'));
});

app.get('/inventario-maquinas', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'catalogo.html'));
});

app.get('/inventario-procesos', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'catalogo.html'));
});

app.get('/inventario-tipos-salida', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'catalogo.html'));
});

app.get('/costos', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'costos.html'));
});

app.get('/calculo-flexografia', (req, res) => {
    try {
        res.type('html').send(renderIntegratedFlexoHtml());
    } catch (error) {
        res.status(500).send(error.message || 'No fue posible abrir el cotizador integrado.');
    }
});

app.get('/cotizador-flexografia-pro', (req, res) => {
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(`/calculo-flexografia${query}`);
});

app.get('/orden-produccion/:codigo', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'orden-produccion.html'));
});

app.get('/ordenes-produccion', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'ordenes-produccion.html'));
});

app.get('/planificacion/gantt', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'planificacion', 'gantt.html'));
});

app.get('/planificacion/lanzamiento', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'planificacion', 'lanzamiento.html'));
});

app.get('/planificacion', (req, res) => {
    res.redirect('/planificacion/lanzamiento');
});

app.get('/planificacion/configuracion', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'planificacion', 'configuracion.html'));
});

app.get('/planificacion/preturno', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'planificacion', 'preturno.html'));
});

app.get('/planificacion/mes-operario', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'planificacion', 'mes-operario.html'));
});

app.get('/planificacion/mes-planchas', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'planificacion', 'mes-planchas.html'));
});

app.get('/planificacion/dashboard-kpi', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'planificacion', 'dashboard-kpi.html'));
});

app.get('/cotizaciones/documento', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/cotizaciones', (req, res) => {
    shouldServeSellerMobile(req)
        .then((useMobile) => {
            if (useMobile) {
                res.type('html').send(renderSellerMobileHtml());
                return;
            }
            res.sendFile(path.join(__dirname, 'public', 'cotizaciones.html'));
        })
        .catch((error) => {
            res.status(500).send(error.message || 'No fue posible abrir cotizaciones.');
        });
});

app.get('/vendedores', (req, res) => {
    try {
        res.type('html').send(renderSellerMobileHtml());
    } catch (error) {
        res.status(500).send(error.message || 'No fue posible abrir la vista móvil de vendedores.');
    }
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// =============================================================
// AUTHENTICATION & SECURITY
// =============================================================

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';

// Middleware for JWT validation
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Login Endpoint
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pgQuery('SELECT * FROM usuarios WHERE username = $1 AND activo = TRUE', [username]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, rol: user.rol, es_root: user.es_root },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                nombre: user.nombre,
                username: user.username,
                rol: user.rol,
                foto_url: user.foto_url
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =============================================================
// TMS — API ENDPOINTS
// =============================================================

// Gestión de Usuarios (Sólo Admin)
app.get('/api/tms/usuarios', authenticateToken, async (req, res) => {
    if (req.user.rol !== 'admin') return res.sendStatus(403);
    try {
        // Ocultar al root del listado normal para seguridad
        const result = await pgQuery('SELECT id, nombre, username, email, rol, activo, foto_url FROM usuarios WHERE es_root = FALSE ORDER BY nombre ASC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tms/usuarios', authenticateToken, async (req, res) => {
    if (req.user.rol !== 'admin') return res.sendStatus(403);
    const { nombre, username, email, password, rol, foto_url } = req.body;
    try {
        const password_hash = await bcrypt.hash(password, 10);
        await pgQuery(
            `INSERT INTO usuarios (nombre, username, email, password_hash, rol, foto_url) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [nombre, username, email, password_hash, rol, foto_url]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/tms/usuarios/:id', authenticateToken, async (req, res) => {
    if (req.user.rol !== 'admin') return res.sendStatus(403);
    const { id } = req.params;
    try {
        // No permitir borrar al superadmin (aunque no debería salir en la lista)
        await pgQuery('DELETE FROM usuarios WHERE id = $1 AND es_root = FALSE', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Vehículos y Tarifas
app.get('/api/tms/vehiculos', authenticateToken, async (req, res) => {
    try {
        const result = await pgQuery('SELECT * FROM vehiculos WHERE activo = TRUE ORDER BY placa ASC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/tms/vehiculos/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const {
        colaborador, combustible_costo, combustible_tipo, peajes, viaticos, utilidad, adic_col, adic_viat,
        tarifa_gam, media_tarifa, t_in_sj, t_out_sj, t_in_ctg, t_out_ctg,
        hospedaje, viatico_diario
    } = req.body;
    
    try {
        await pgQuery(
            `UPDATE vehiculos SET 
                colaborador = $1, combustible_costo = $2, combustible_tipo = $3, peajes = $4, viaticos = $5, utilidad = $6, adic_col = $7, adic_viat = $8,
                tarifa_gam = $9, media_tarifa = $10, t_in_sj = $11, t_out_sj = $12, t_in_ctg = $13, t_out_ctg = $14,
                hospedaje = $15, viatico_diario = $16, updated_at = NOW()
             WHERE id = $17`,
            [colaborador, combustible_costo, combustible_tipo, peajes, viaticos, utilidad, adic_col, adic_viat,
             tarifa_gam, media_tarifa, t_in_sj, t_out_sj, t_in_ctg, t_out_ctg,
             hospedaje, viatico_diario, id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Proformas / Cotizaciones
app.get('/api/tms/proformas', authenticateToken, async (req, res) => {
    try {
        const result = await pgQuery('SELECT * FROM tms_cotizaciones ORDER BY fecha_emision DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tms/proformas', authenticateToken, async (req, res) => {
    const { numero, cliente_nombre, cliente_empresa, total_usd, data_json } = req.body;
    try {
        const result = await pgQuery(
            `INSERT INTO tms_cotizaciones (numero, cliente_nombre, cliente_empresa, total_usd, data_json)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (numero) DO UPDATE SET
                cliente_nombre = EXCLUDED.cliente_nombre,
                cliente_empresa = EXCLUDED.cliente_empresa,
                total_usd = EXCLUDED.total_usd,
                data_json = EXCLUDED.data_json,
                updated_at = NOW()
             RETURNING id`,
            [numero, cliente_nombre, cliente_empresa, total_usd, JSON.stringify(data_json)]
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/tms/proformas/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await pgQuery('DELETE FROM tms_cotizaciones WHERE id = $1 OR numero = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Configuración Global
app.get('/api/tms/config/:clave', authenticateToken, async (req, res) => {
    const { clave } = req.params;
    try {
        const result = await pgQuery('SELECT valor FROM tms_config WHERE clave = $1', [clave]);
        res.json(result.rows[0]?.valor || {});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tms/config/:clave', authenticateToken, async (req, res) => {
    const { clave } = req.params;
    const { valor } = req.body;
    try {
        await pgQuery(
            `INSERT INTO tms_config (clave, valor) VALUES ($1, $2)
             ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = NOW()`,
            [clave, JSON.stringify(valor)]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

export default app;


