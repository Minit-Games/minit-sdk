
export type DropResultOptions = {
    flavorText?: string,
    delay?: number,
}

export type MinitApi = {
    environment: "app" | "web",
    sdkVersion: string,
    dropConfig: Record<string, string>,

    reportResult: (result: number|string, options?: DropResultOptions) => void,
}
