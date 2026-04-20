package com.example.traffic.config;

import java.util.List;

public record ScenarioCatalogDefinition(
    String defaultScenarioId, List<ScenarioPresetDefinition> scenarios) {}
