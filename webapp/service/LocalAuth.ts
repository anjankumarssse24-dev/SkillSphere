type SupportedRole = "Employee" | "Manager" | "SeniorManager";

type NavigationTarget = {
    routeName: string;
    parameterName: string;
};

type LocalMockUser = {
    id: string;
    resolvedEmployeeId?: string;
    name: string;
    role: SupportedRole;
    password: string;
    email: string;
    navigation: NavigationTarget;
};

export type LocalLoginResult = {
    success: boolean;
    message?: string;
    user?: {
        id: string;
        name: string;
        role: SupportedRole;
        email: string;
        isLoggedIn: true;
        employeeId?: string;
        managerId?: string;
        seniorManagerId?: string;
    };
    navigation?: {
        routeName: string;
        parameters: Record<string, string>;
    };
};

const LOCAL_MOCK_USERS: LocalMockUser[] = [
    {
        id: "I770144",
        resolvedEmployeeId: "I750145",
        name: "Sreeja Reddy",
        role: "Employee",
        password: "password123",
        email: "sreeja.reddy.kattekommula@sap.com",
        navigation: {
            routeName: "EmployeeDashboard",
            parameterName: "employeeId"
        }
    },
    {
        id: "MGR003",
        resolvedEmployeeId: "I042040",
        name: "Puja K",
        role: "Manager",
        password: "manager123",
        email: "puja.k@sap.com",
        navigation: {
            routeName: "ManagerDashboard",
            parameterName: "managerId"
        }
    },
    {
        id: "SMGR01",
        resolvedEmployeeId: "I305034",
        name: "Nirmala Shettar",
        role: "SeniorManager",
        password: "manager123",
        email: "nirmala.shettar@sap.com",
        navigation: {
            routeName: "SeniorManagerDashboard",
            parameterName: "seniorManagerId"
        }
    }
];

export default class LocalAuth {
    public static isLocalMode(): boolean {
        const hostname = window.location.hostname.toLowerCase();
        const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
        // ?localAuth=true is only honoured on localhost — never on production URLs
        const forceLocal = isLocalHost && new URLSearchParams(window.location.search).get("localAuth") === "true";

        return forceLocal || isLocalHost;
    }

    public static getMockUsers(): Array<Pick<LocalMockUser, "id" | "name" | "role" | "email">> {
        return LOCAL_MOCK_USERS.map(({ id, name, role, email }) => ({ id, name, role, email }));
    }

    public static async authenticate(
        expectedRole: SupportedRole,
        identifier: string,
        password: string,
        oDataModel: any
    ): Promise<LocalLoginResult> {
        const normalizedId = identifier.trim();
        const normalizedPassword = password.trim();

        if (!normalizedId || !normalizedPassword) {
            return {
                success: false,
                message: "Enter both ID and password."
            };
        }

        const mockUser = LOCAL_MOCK_USERS.find(user => user.id === normalizedId && user.role === expectedRole);

        if (!mockUser) {
            return {
                success: false,
                message: `Use the configured local ${expectedRole} test user for this screen.`
            };
        }

        if (mockUser.password !== normalizedPassword) {
            return {
                success: false,
                message: "Invalid password for the selected local user."
            };
        }

        const resolvedId = (mockUser.resolvedEmployeeId || mockUser.id).trim().toUpperCase();
        const employeeDetails = await this.loadEmployeeDetails(oDataModel, mockUser, resolvedId);
        const user = {
            id: resolvedId,
            name: employeeDetails?.name || mockUser.name,
            role: mockUser.role,
            email: employeeDetails?.email || mockUser.email,
            isLoggedIn: true as const,
            employeeId: mockUser.role === "Employee" ? resolvedId : undefined,
            managerId: mockUser.role === "Manager" ? resolvedId : undefined,
            seniorManagerId: mockUser.role === "SeniorManager" ? resolvedId : undefined
        };

        return {
            success: true,
            user,
            navigation: {
                routeName: mockUser.navigation.routeName,
                parameters: {
                    [mockUser.navigation.parameterName]: resolvedId
                }
            }
        };
    }

    private static async loadEmployeeDetails(oDataModel: any, mockUser: LocalMockUser, resolvedId: string): Promise<any | null> {
        if (!oDataModel) {
            return null;
        }

        try {
            const contextBinding = oDataModel.bindContext(`/Employees('${resolvedId}')`);
            return await contextBinding.requestObject();
        } catch (error) {
            console.warn(`[LocalAuth] Failed to load employee details for ${resolvedId}:`, error);
            return null;
        }
    }
}