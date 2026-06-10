# -*- mode: python ; coding: utf-8 -*-

a = Analysis(
    ['orchestrator\\run_backend.py'],
    pathex=['orchestrator'],
    binaries=[],
    datas=[('mcp_servers', 'mcp_servers')],
    hiddenimports=[
        'github', 'github.AuthenticatedUser', 'github.Github', 'github.GithubException', 'github.InputGitAuthor',
        'jira', 'confluence', 'playwright'
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='devfoundry-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
