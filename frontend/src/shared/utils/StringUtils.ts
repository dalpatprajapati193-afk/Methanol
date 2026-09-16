export const dummy = "dummy";


export const digitDecimal = (num: number, showPositive: Boolean) => {
    if (isNaN(num)) {
        num = 0
    }
    if (showPositive) {
        num = Math.abs(num)
    }
    if (!Number.isFinite(num)) {
        return num
    } else if (Number.isInteger(num)) {
        return formatNumbers(num)
    } else {
        if (num <= 99) {
            return formatNumbers(num.toFixed(1))
        } else {
            return formatNumbers(num.toFixed(0))
        }
    }
}

export const formatNumbers = (num: string | number, maxFraction = 5) => {
    if (num == null || num == undefined) {
        return '-'
    }
    const numericValue =
        typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : num
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: maxFraction,
    }).format(numericValue)
}