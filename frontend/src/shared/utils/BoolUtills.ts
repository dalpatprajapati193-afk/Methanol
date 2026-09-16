export const getValsBaseOnCondition = (condition: boolean | (() => boolean), ifTrue: any, elseWise: any) => {
    const result = typeof condition === 'function' ? condition() : condition
    return result ? ifTrue : elseWise
}

export function textToSlug(text: string | null | undefined) {
    let t = text?.toLowerCase()?.replace(/\s+/g, '+')
    return t
}

export function slugToText(text: string | null | undefined) {
    let t = text ? text : ''
    t = t.replaceAll('+', ' ').replace(/\w\S*/g, function (txt: string) {
        return txt.charAt(0)?.toUpperCase() + txt.substring(1)?.toLowerCase()
    })
    return t
}

export function getSystemsByPlantID(plant_id: number | string | null = null, caseData: any[] = []) {
    if (plant_id && caseData.length > 0) {
        return caseData.filter((obj) => obj.plant_id == plant_id)
    } else {
        return []
    }
}
export function getPlantIdByName(
    plant_name: string | null = null,
    affiliate: string = '',
    caseData: any[] = [],
) {
    if (plant_name && caseData.length > 0) {
        return caseData.find(
            (obj) =>
                obj.plant?.toLowerCase() == plant_name?.toLowerCase() &&
                obj.affiliate?.toLowerCase() == affiliate?.toLowerCase(),
        )
    } else {
        return EMPTY_CASE
    }
}
export function getSystemsByPlantName(
    plant_name: string | null = null,
    affiliate: string = '',
    caseData: any[] = [],
) {
    if (plant_name && caseData.length > 0) {
        const plant_id = getPlantIdByName(plant_name, affiliate, caseData)?.plant_id
        return getSystemsByPlantID(plant_id, caseData)
    } else {
        return []
    }
}

export function getSystemsByAffiliateName(
    affiliate_name: string | null = null,
    caseData: any[] = [],
) {
    if (affiliate_name && caseData.length > 0) {
        const affiliate_code = getAffiliateIdByName(
            affiliate_name,
            caseData,
        )?.affiliate_code
        return getSystemsByAffiliateID(affiliate_code, caseData)
    } else {
        return []
    }
}

export function getAffiliateIdByName(affiliate_name: string | null = null, caseData: any[] = []) {
    if (affiliate_name && caseData.length > 0) {
        return caseData.find(
            (obj) => obj.affiliate?.toLowerCase() == affiliate_name?.toLowerCase(),
        )
    } else {
        return EMPTY_CASE
    }
}

export function getSystemsByAffiliateID(affiliate_code: string | number | null = null, caseData: any[] = []) {
  if (affiliate_code && caseData.length > 0) {
    return caseData.filter((obj) => obj.affiliate_code == affiliate_code)
  } else {
    return []
  }
}


export const EMPTY_CASE = {
  affiliate: null,
  affiliate_code: null,
  case_id: null,
  plant: null,
  plant_id: null,
  region: null,
  system: null,
}