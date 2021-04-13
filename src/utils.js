/**
 * Recursively check equality between two objects
 * @param {*} first First object
 * @param {*} second Second object
 * @returns true or false
 */
export const deepEqual = (first, second) => {
    const firstType = typeof first,
        secondType = typeof second;

    // both are arrays
    if (
        Array.isArray(first) &&
        Array.isArray(second) &&
        first.length === second.length
    ) {
        return first.every((obj, idx) => deepEqual(obj, second[idx]));
    }

    // first is Date, second is date string
    if (
        firstType === "object" &&
        first instanceof Date &&
        secondType === "string"
    ) {
        return first.getTime() === new Date(second).getTime();
    }

    // first is date string, second is Date
    if (
        secondType === "object" &&
        second instanceof Date &&
        firstType === "string"
    ) {
        return new Date(first).getTime() === second.getTime();
    }

    // first is Date, second is also Date
    if (
        firstType === "object" &&
        firstType === secondType &&
        first instanceof Date &&
        second instanceof Date
    ) {
        return first.getTime() === second.getTime();
    }

    // both are objects
    if (firstType === "object" && firstType === secondType) {
        return (
            Object.keys(first).length === Object.keys(second).length &&
            Object.keys(first).every((key) =>
                deepEqual(first[key], second[key])
            )
        );
    }

    return first === second;
};
