/**
 * Centralized API v2 route definitions.
 * Use these constants/functions in services instead of hardcoding endpoint paths.
 */
export const Routes = {
  Auth: {
    challenge: '/auth/challenge',
    ksefToken: '/auth/ksef-token',
    xadesSignature: '/auth/xades-signature',
    status: (referenceNumber: string) => `/auth/${referenceNumber}`,
    tokenRedeem: '/auth/token/redeem',
    tokenRefresh: '/auth/token/refresh'
  },
  AuthSessions: {
    root: '/auth/sessions',
    current: '/auth/sessions/current',
    byReference: (referenceNumber: string) => `/auth/sessions/${referenceNumber}`
  },
  Sessions: {
    root: '/sessions',
    onlineOpen: '/sessions/online',
    onlineClose: (referenceNumber: string) => `/sessions/online/${referenceNumber}/close`,
    onlineInvoices: (referenceNumber: string) => `/sessions/online/${referenceNumber}/invoices`,
    batchOpen: '/sessions/batch',
    batchClose: (referenceNumber: string) => `/sessions/batch/${referenceNumber}/close`,
    byReference: (referenceNumber: string) => `/sessions/${referenceNumber}`,
    invoices: (referenceNumber: string) => `/sessions/${referenceNumber}/invoices`,
    failedInvoices: (referenceNumber: string) => `/sessions/${referenceNumber}/invoices/failed`,
    invoiceStatus: (referenceNumber: string, invoiceReferenceNumber: string) =>
      `/sessions/${referenceNumber}/invoices/${invoiceReferenceNumber}`,
    invoiceUpoByKsef: (referenceNumber: string, ksefNumber: string) =>
      `/sessions/${referenceNumber}/invoices/ksef/${ksefNumber}/upo`,
    invoiceUpoByReference: (referenceNumber: string, invoiceReferenceNumber: string) =>
      `/sessions/${referenceNumber}/invoices/${invoiceReferenceNumber}/upo`,
    sessionUpo: (referenceNumber: string, upoReferenceNumber: string) =>
      `/sessions/${referenceNumber}/upo/${upoReferenceNumber}`
  },
  Invoices: {
    queryMetadata: '/invoices/query/metadata',
    exports: '/invoices/exports',
    exportStatus: (referenceNumber: string) => `/invoices/exports/${referenceNumber}`,
    byKsefNumber: (ksefNumber: string) => `/invoices/ksef/${ksefNumber}`
  },
  Permissions: {
    grantPersons: '/permissions/persons/grants',
    grantEntities: '/permissions/entities/grants',
    grantAuthorizations: '/permissions/authorizations/grants',
    grantIndirect: '/permissions/indirect/grants',
    grantSubunits: '/permissions/subunits/grants',
    grantEuEntitiesAdministration: '/permissions/eu-entities/administration/grants',
    grantEuEntities: '/permissions/eu-entities/grants',
    attachmentStatus: '/permissions/attachments/status',
    revokeCommon: (permissionId: string) => `/permissions/common/grants/${permissionId}`,
    revokeAuthorization: (permissionId: string) => `/permissions/authorizations/grants/${permissionId}`,
    operationStatus: (referenceNumber: string) => `/permissions/operations/${referenceNumber}`,
    queryPersonal: '/permissions/query/personal/grants',
    queryPersons: '/permissions/query/persons/grants',
    querySubunits: '/permissions/query/subunits/grants',
    queryEntityRoles: '/permissions/query/entities/roles',
    querySubordinateEntityRoles: '/permissions/query/subordinate-entities/roles',
    queryAuthorizationGrants: '/permissions/query/authorizations/grants',
    queryEuEntityGrants: '/permissions/query/eu-entities/grants'
  },
  Tokens: {
    root: '/tokens',
    byReference: (referenceNumber: string) => `/tokens/${referenceNumber}`
  },
  Certificates: {
    limits: '/certificates/limits',
    enrollmentData: '/certificates/enrollments/data',
    enrollments: '/certificates/enrollments',
    enrollmentStatus: (referenceNumber: string) => `/certificates/enrollments/${referenceNumber}`,
    retrieve: '/certificates/retrieve',
    revoke: (serialNumber: string) => `/certificates/${serialNumber}/revoke`,
    query: '/certificates/query'
  },
  RateLimits: {
    effectiveApi: '/rate-limits',
    context: '/limits/context',
    subject: '/limits/subject'
  },
  Peppol: {
    query: '/peppol/query'
  },
  TestData: {
    grantPermissions: '/testdata/permissions',
    revokePermissions: '/testdata/permissions/revoke',
    enableAttachments: '/testdata/attachment',
    disableAttachments: '/testdata/attachment/revoke',
    createSubject: '/testdata/subject',
    removeSubject: '/testdata/subject/remove',
    createPerson: '/testdata/person',
    removePerson: '/testdata/person/remove',
    sessionLimits: '/testdata/limits/context/session',
    subjectLimits: '/testdata/limits/subject/certificate',
    rateLimits: '/testdata/rate-limits',
    productionRateLimits: '/testdata/rate-limits/production'
  },
  Security: {
    publicKeyCertificates: '/security/public-key-certificates'
  }
} as const;
