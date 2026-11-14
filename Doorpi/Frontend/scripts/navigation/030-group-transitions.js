function getGroupTransition(direction, groupName, groups, current) {
    const { sidebar, filters, apps, actions, folderBtns, subtabs, inputs, storeBtns, emulatorItems, emulatorMenus, activeTab } = groups;
    const firstVisible = (arr) => arr.find(el => el.offsetWidth > 0 && el.offsetHeight > 0);

    const bestSidebar = () => {
        const navigable = sidebar.filter(el => !el.classList.contains('active'));
        if (_lastFocusedSidebar && navigable.includes(_lastFocusedSidebar)) return _lastFocusedSidebar;
        return navigable[0] || null;
    };

    const bestFilter = () => {
        const navigableFilters = filters.filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
        if (_lastFocusedFilter && navigableFilters.includes(_lastFocusedFilter)) return _lastFocusedFilter;
        return navigableFilters[0] || null;
    };

    if (activeTab === 'view-apps') {
        const bestApp = () => {
            const navigableApps = apps.filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
            if (_lastFocusedApp && navigableApps.includes(_lastFocusedApp)) return _lastFocusedApp;
            return navigableApps[0] || null;
        };

        if (groupName === 'filter') {
            if (direction === 'UP') return current;
            if (direction === 'DOWN') return bestApp();
            if (direction === 'LEFT' || direction === 'RIGHT') {
                const target = findSpatialCandidate(filters, current, direction);
                if (target) return target;
                if (direction === 'LEFT') return bestSidebar();
                return current;
            }
        }
        if (groupName === 'app') {
            if (direction === 'DOWN' || direction === 'RIGHT') return actions[0] ?? null;
            if (direction === 'LEFT') return bestSidebar();
            if (direction === 'UP') return bestFilter();
        }
        if (groupName === 'sidebar') {
            if (direction === 'RIGHT') return bestApp() || bestFilter() || actions[0];
            if (direction === 'DOWN') return bestApp();
            if (direction === 'UP') return bestFilter();
        }
        if (groupName === 'action' && (direction === 'LEFT' || direction === 'UP')) return bestApp();

    } else if (activeTab === 'view-folders') {
        const bestFolderBtn = () => firstVisible(folderBtns);
        if (groupName === 'folderBtn') {
            if (direction === 'LEFT') return bestSidebar();
            if (direction === 'DOWN') return actions[0] ?? null;
        }
        if (groupName === 'action') {
            if (direction === 'UP') return folderBtns[folderBtns.length - 1] ?? null;
            if (direction === 'LEFT') return bestSidebar();
        }
        if (groupName === 'sidebar') {
            if (direction === 'RIGHT') return bestFolderBtn() || actions[0];
            if (direction === 'DOWN') return bestFolderBtn() || actions[0];
        }
    } else if (activeTab === 'view-media-apps') {
        const bestApp = () => {
            const navigableApps = apps.filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
            if (_lastFocusedApp && navigableApps.includes(_lastFocusedApp)) return _lastFocusedApp;
            return navigableApps[0] || null;
        };

        const bestInput = () => firstVisible(inputs);
        const bestSubtab = () => {
            const active = subtabs.find(s => s.classList.contains('active'));
            return active || subtabs[0];
        };

        if (groupName === 'subtab') {
            if (direction === 'DOWN') return bestInput() || bestApp();
            if (direction === 'LEFT') return bestSidebar();
        }
        if (groupName === 'input') {
            const idx = inputs.indexOf(current);
            const isPasteBtn = current.id === 'btnWebAppPaste';
            const isBrowserBtn = current.id === 'btnWebAppBrowser';

            if (direction === 'LEFT') {
                if ((isPasteBtn || isBrowserBtn) && idx > 0) return inputs[idx - 1];
                return bestSidebar();
            }
            if (direction === 'RIGHT') {
                if (inputs[idx + 1]) return inputs[idx + 1];
                return null;
            }
            if (direction === 'UP') {
                if (isPasteBtn || isBrowserBtn) return inputs[0];
                return idx > 0 ? inputs[idx - 1] : bestSubtab();
            }
            if (direction === 'DOWN') {
                if (idx === 0) return inputs[1];
                return actions[0];
            }
        }
        if (groupName === 'app') {
            if (direction === 'DOWN' || direction === 'RIGHT') return actions[0] ?? null;
            if (direction === 'LEFT') return bestSidebar();
            if (direction === 'UP') return bestSubtab();
        }
        if (groupName === 'action') {
            if (direction === 'UP') return inputs[inputs.length - 1] || bestApp() || bestSubtab();
            if (direction === 'LEFT') return bestSidebar();
        }
        if (groupName === 'sidebar') {
            if (direction === 'RIGHT' || direction === 'DOWN') return bestSubtab() || bestInput() || bestApp() || actions[0];
        }
    } else if (activeTab === 'view-stores') {
        const bestStoreBtn = () => firstVisible(storeBtns);
        if (groupName === 'storeBtn') {
            if (direction === 'LEFT') return bestSidebar();
            if (direction === 'DOWN' || direction === 'RIGHT') return actions[0] ?? null;
        }
        if (groupName === 'action') {
            if (direction === 'UP') return storeBtns[storeBtns.length - 1] ?? null;
            if (direction === 'LEFT') return bestSidebar();
        }
        if (groupName === 'sidebar') {
            if (direction === 'RIGHT' || direction === 'DOWN') return bestStoreBtn() || actions[0];
        }
    } else if (activeTab === 'view-emulators') {
        const emulatorEditor = document.querySelector('#view-emulators .emulator-editor-overlay');
        if (emulatorEditor?.contains(current)) return current;
        if (groupName === 'emulator') {
            if (direction === 'LEFT') return bestSidebar();
            if (direction === 'DOWN') return firstVisible(actions);
        }
        if (groupName === 'emulatorMenu') {
            if (direction === 'DOWN')
                return current.closest('.emulator-library-card')?.querySelector('.emulator-card-launch') || current;
            return current;
        }
        if (groupName === 'action') {
            if (direction === 'UP') return emulatorItems[emulatorItems.length - 1] ?? null;
            if (direction === 'LEFT' && actions.indexOf(current) === 0) return bestSidebar();
        }
        if (groupName === 'sidebar' && (direction === 'RIGHT' || direction === 'DOWN'))
            return firstVisible(emulatorItems || []) || firstVisible(actions);
    }
    return null;
}

