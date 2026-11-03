with open('backend/services/agent/graph/router.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if "return routeReturn(targetAgent" in line and len(new_lines) < 15:
        new_lines.append("  return { agent: targetAgent };\n")
    else:
        new_lines.append(line)

with open('backend/services/agent/graph/router.js', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print("Router fix successfully applied.")

