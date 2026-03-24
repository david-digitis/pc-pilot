#!/bin/bash
# Build RPM package from electron-builder's linux-unpacked output
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
APP_NAME="pc-pilot"
APP_LABEL="PC-Pilot"
VERSION="0.1.0"
UNPACKED="$PROJECT_DIR/dist/linux-unpacked"

if [ ! -d "$UNPACKED" ]; then
  echo "Error: $UNPACKED not found. Run 'npm run build:linux' first."
  exit 1
fi

# Setup rpmbuild tree in /tmp
RPMBUILD=$(mktemp -d)
mkdir -p "$RPMBUILD"/{BUILD,RPMS,SOURCES,SPECS,SRPMS}

# Create a tarball of the app as source
STAGING=$(mktemp -d)
mkdir -p "$STAGING/$APP_NAME-$VERSION"
cp -a "$UNPACKED"/. "$STAGING/$APP_NAME-$VERSION/app/"
cp "$PROJECT_DIR/assets/icon.png" "$STAGING/$APP_NAME-$VERSION/"
tar czf "$RPMBUILD/SOURCES/$APP_NAME-$VERSION.tar.gz" -C "$STAGING" "$APP_NAME-$VERSION"
rm -rf "$STAGING"

# Write spec file
cat > "$RPMBUILD/SPECS/${APP_NAME}.spec" <<'SPEC'
Name:           pc-pilot
Version:        0.1.0
Release:        1%{?dist}
Summary:        REST service to control PC from home automation
License:        MIT
URL:            https://github.com/david-digitis/pc-pilot
Source0:        %{name}-%{version}.tar.gz

AutoReqProv:    no

%description
Local REST service to control a PC (shutdown, reboot, sleep, launch apps)
from a home automation system like Gladys Assistant.

%prep
%setup -q

%install
mkdir -p %{buildroot}/opt/PC-Pilot
cp -a app/* %{buildroot}/opt/PC-Pilot/

mkdir -p %{buildroot}/usr/bin
ln -sf /opt/PC-Pilot/pc-pilot %{buildroot}/usr/bin/pc-pilot

mkdir -p %{buildroot}/usr/share/applications
cat > %{buildroot}/usr/share/applications/pc-pilot.desktop <<EOF
[Desktop Entry]
Type=Application
Name=PC-Pilot
Comment=REST service to control PC from home automation
Exec=env ELECTRON_RUN_AS_NODE= /opt/PC-Pilot/pc-pilot %U
Icon=pc-pilot
Terminal=false
Categories=Utility;
StartupWMClass=pc-pilot
EOF

mkdir -p %{buildroot}/usr/share/icons/hicolor/256x256/apps
cp icon.png %{buildroot}/usr/share/icons/hicolor/256x256/apps/pc-pilot.png

%files
/opt/PC-Pilot/
/usr/share/applications/pc-pilot.desktop
/usr/share/icons/hicolor/256x256/apps/pc-pilot.png
/usr/bin/pc-pilot

%post
update-desktop-database /usr/share/applications/ 2>/dev/null || true
gtk-update-icon-cache /usr/share/icons/hicolor/ 2>/dev/null || true

%postun
update-desktop-database /usr/share/applications/ 2>/dev/null || true
gtk-update-icon-cache /usr/share/icons/hicolor/ 2>/dev/null || true
SPEC

# Build RPM
rpmbuild --define "_topdir $RPMBUILD" \
         --define "_build_id_links none" \
         --define "__os_install_post %{nil}" \
         --define "debug_package %{nil}" \
         -bb "$RPMBUILD/SPECS/${APP_NAME}.spec"

# Copy result
RPM_FILE=$(find "$RPMBUILD/RPMS" -name "*.rpm" | head -1)
if [ -n "$RPM_FILE" ]; then
  cp "$RPM_FILE" "$PROJECT_DIR/dist/"
  echo "RPM built: $PROJECT_DIR/dist/$(basename "$RPM_FILE")"
else
  echo "Error: RPM not found"
  exit 1
fi

# Cleanup
rm -rf "$RPMBUILD"
