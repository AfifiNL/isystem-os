"use client";

import { Environment } from "@react-three/drei";

const CITY_ENVIRONMENT_PATH = "/three/environments/";
const CITY_ENVIRONMENT_FILE = "potsdamer_platz_1k.hdr";

export function CityEnvironment() {
    return <Environment files={CITY_ENVIRONMENT_FILE} path={CITY_ENVIRONMENT_PATH} />;
}
