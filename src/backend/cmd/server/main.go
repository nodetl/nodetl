package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/nodetl/nodetl/config"
	"github.com/nodetl/nodetl/internal/domain"
	"github.com/nodetl/nodetl/internal/executor"
	"github.com/nodetl/nodetl/internal/handler"
	"github.com/nodetl/nodetl/internal/middleware"
	"github.com/nodetl/nodetl/internal/repository"
	"github.com/nodetl/nodetl/internal/service"
	"github.com/nodetl/nodetl/pkg/ai"
	"github.com/nodetl/nodetl/pkg/logger"
	"github.com/nodetl/nodetl/pkg/mongodb"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize logger
	if err := logger.Init(cfg.Logging.Level, cfg.Logging.Format); err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}
	defer logger.Sync()

	logger.Log.Info("Starting NodeTL...")

	// Connect to MongoDB
	mongoClient, err := mongodb.NewClient(cfg.MongoDB.URI, cfg.MongoDB.Database)
	if err != nil {
		logger.Log.Fatalw("Failed to connect to MongoDB", "error", err)
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		mongoClient.Close(ctx)
	}()

	logger.Log.Info("Connected to MongoDB")

	// Initialize repositories
	workflowRepo := repository.NewWorkflowRepository(mongoClient)
	schemaRepo := repository.NewSchemaRepository(mongoClient)
	nodeTypeRepo := repository.NewNodeTypeRepository(mongoClient)
	executionRepo := repository.NewExecutionRepository(mongoClient)
	mappingRepo := repository.NewMappingRepository(mongoClient)
	nodeSchemaRepo := repository.NewNodeSchemaRepository(mongoClient)
	versionRepo := repository.NewVersionRepository(mongoClient)
	projectRepo := repository.NewProjectRepository(mongoClient)

	// Auth repositories
	userRepo := repository.NewUserRepository(mongoClient)
	roleRepo := repository.NewRoleRepository(mongoClient)
	refreshTokenRepo := repository.NewRefreshTokenRepository(mongoClient)
	invitationRepo := repository.NewInvitationRepository(mongoClient)
	settingsRepo := repository.NewSettingsRepository(mongoClient)

	// Seed predefined data
	ctx := context.Background()
	if err := schemaRepo.SeedPredefined(ctx); err != nil {
		logger.Log.Warnw("Failed to seed predefined schemas", "error", err)
	}
	if err := nodeTypeRepo.SeedBuiltIn(ctx); err != nil {
		logger.Log.Warnw("Failed to seed built-in node types", "error", err)
	}

	// Seed default app settings
	appSettingsConfig := &repository.AppSettingsConfig{
		Name:           cfg.App.Name,
		LogoPath:       cfg.App.LogoPath,
		PrimaryColor:   cfg.App.PrimaryColor,
		SecondaryColor: cfg.App.SecondaryColor,
	}
	if err := settingsRepo.SeedDefaults(ctx, appSettingsConfig); err != nil {
		logger.Log.Warnw("Failed to seed default settings", "error", err)
	}

	// Initialize services
	mappingService := ai.NewMappingService(&cfg.AI)
	aiService := service.NewAIService()
	flowExecutor := executor.NewFlowExecutor(workflowRepo, executionRepo, nodeSchemaRepo)

	// Auth services
	authService := service.NewAuthService(userRepo, roleRepo, refreshTokenRepo, &cfg.Auth)
	emailService := service.NewEmailService(&cfg.SMTP)
	invitationService := service.NewInvitationService(invitationRepo, userRepo, roleRepo, emailService, cfg.App.Domain)

	// Seed admin user (will only create on first run)
	if cfg.Auth.AutoCreateAdmin {
		if err := authService.SeedAdminUser(ctx); err != nil {
			logger.Log.Warnw("Failed to seed admin user", "error", err)
		}
	}

	// Seed default project (will only create on first run)
	if err := projectRepo.SeedDefaultProject(ctx); err != nil {
		logger.Log.Warnw("Failed to seed default project", "error", err)
	}

	// Initialize handlers
	workflowHandler := handler.NewWorkflowHandler(workflowRepo, projectRepo)
	schemaHandler := handler.NewSchemaHandler(schemaRepo)
	nodeTypeHandler := handler.NewNodeTypeHandler(nodeTypeRepo)
	mappingHandler := handler.NewMappingHandler(mappingRepo, schemaRepo, mappingService)
	executionHandler := handler.NewExecutionHandler(executionRepo, workflowRepo, flowExecutor)
	webhookHandler := handler.NewWebhookHandler(flowExecutor)
	nodeSchemaHandler := handler.NewNodeSchemaHandler(nodeSchemaRepo)
	aiHandler := handler.NewAIHandler(aiService)
	versionHandler := handler.NewVersionHandler(versionRepo)
	projectHandler := handler.NewProjectHandler(projectRepo, workflowRepo)

	// Auth handlers
	authHandler := handler.NewAuthHandler(authService)
	userHandler := handler.NewUserHandler(userRepo, roleRepo)
	roleHandler := handler.NewRoleHandler(roleRepo, userRepo)
	invitationHandler := handler.NewInvitationHandler(invitationService)
	settingsHandler := handler.NewSettingsHandler(settingsRepo)

	// Setup Gin
	if cfg.Server.Mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(middleware.ErrorHandler())
	r.Use(middleware.Logger())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Auth middleware
	jwtManager := authService.GetJWTManager()
	authMiddleware := middleware.AuthMiddleware(jwtManager)
	_ = middleware.OptionalAuthMiddleware(jwtManager) // optionalAuth for future use

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Public routes (no auth required)
	// Settings (public read)
	r.GET("/api/v1/settings", settingsHandler.GetSettings)
	r.GET("/api/v1/auth/providers", authHandler.GetOAuthProviders)

	// Auth routes (public)
	auth := r.Group("/api/v1/auth")
	{
		auth.POST("/login", authHandler.Login)
		auth.POST("/refresh", authHandler.RefreshToken)
		auth.GET("/google", authHandler.GoogleAuth)
		auth.GET("/google/callback", authHandler.GoogleCallback)
		auth.GET("/microsoft", authHandler.MicrosoftAuth)
		auth.GET("/microsoft/callback", authHandler.MicrosoftCallback)
	}

	// Invitation accept (public)
	r.POST("/api/v1/invitations/accept", invitationHandler.AcceptInvitation)
	r.GET("/api/v1/invitations/validate", invitationHandler.ValidateInvitation)

	// Protected API routes
	api := r.Group("/api/v1")
	api.Use(authMiddleware)
	{
		// Auth (protected)
		api.POST("/auth/logout", authHandler.Logout)
		api.GET("/auth/me", authHandler.GetMe)
		api.PUT("/auth/preferences", authHandler.UpdatePreferences)
		api.PUT("/auth/password", authHandler.ChangePassword)

		// Users (admin only)
		users := api.Group("/users")
		users.Use(middleware.RequirePermission(string(domain.PermissionUserView)))
		{
			users.GET("", userHandler.ListUsers)
			users.GET("/:id", userHandler.GetUser)
			users.PUT("/:id", middleware.RequirePermission(string(domain.PermissionUserEdit)), userHandler.UpdateUser)
			users.DELETE("/:id", middleware.RequirePermission(string(domain.PermissionUserDelete)), userHandler.DeleteUser)
		}

		// Roles (admin only)
		roles := api.Group("/roles")
		roles.Use(middleware.RequirePermission(string(domain.PermissionRoleView)))
		{
			roles.GET("", roleHandler.ListRoles)
			roles.GET("/permissions", roleHandler.GetAllPermissions)
			roles.GET("/:id", roleHandler.GetRole)
			roles.POST("", middleware.RequirePermission(string(domain.PermissionRoleEdit)), roleHandler.CreateRole)
			roles.PUT("/:id", middleware.RequirePermission(string(domain.PermissionRoleEdit)), roleHandler.UpdateRole)
			roles.DELETE("/:id", middleware.RequirePermission(string(domain.PermissionRoleDelete)), roleHandler.DeleteRole)
		}

		// Invitations (admin only)
		invitations := api.Group("/invitations")
		invitations.Use(middleware.RequirePermission(string(domain.PermissionUserEdit)))
		{
			invitations.GET("", invitationHandler.ListInvitations)
			invitations.GET("/:id", invitationHandler.GetInvitation)
			invitations.POST("", invitationHandler.CreateInvitation)
			invitations.DELETE("/:id", invitationHandler.RevokeInvitation)
			invitations.POST("/:id/resend", invitationHandler.ResendInvitation)
		}

		// Settings (admin only for edit)
		settings := api.Group("/settings")
		{
			settings.GET("/full", middleware.RequirePermission(string(domain.PermissionSettingsView)), settingsHandler.GetFullSettings)
			settings.PUT("", middleware.RequirePermission(string(domain.PermissionSettingsEdit)), settingsHandler.UpdateSettings)
		}

		// Workflows (with permissions)
		workflows := api.Group("/workflows")
		workflows.Use(middleware.RequirePermission(string(domain.PermissionWorkflowView)))
		{
			workflows.POST("", middleware.RequirePermission(string(domain.PermissionWorkflowEdit)), workflowHandler.CreateWorkflow)
			workflows.GET("", workflowHandler.ListWorkflows)
			workflows.GET("/:id", workflowHandler.GetWorkflow)
			workflows.PUT("/:id", middleware.RequirePermission(string(domain.PermissionWorkflowEdit)), workflowHandler.UpdateWorkflow)
			workflows.DELETE("/:id", middleware.RequirePermission(string(domain.PermissionWorkflowDelete)), workflowHandler.DeleteWorkflow)
			workflows.POST("/:id/activate", middleware.RequirePermission(string(domain.PermissionWorkflowEdit)), workflowHandler.ActivateWorkflow)
			workflows.POST("/:id/deactivate", middleware.RequirePermission(string(domain.PermissionWorkflowEdit)), workflowHandler.DeactivateWorkflow)
			workflows.POST("/:id/execute", middleware.RequirePermission(string(domain.PermissionWorkflowEdit)), executionHandler.ExecuteWorkflow)
			workflows.GET("/:id/executions", middleware.RequirePermission(string(domain.PermissionExecutionView)), executionHandler.ListExecutions)
			workflows.GET("/:id/executions/latest", middleware.RequirePermission(string(domain.PermissionExecutionView)), executionHandler.GetLatestExecutions)
		}

		// Schemas (with permissions)
		schemas := api.Group("/schemas")
		schemas.Use(middleware.RequirePermission(string(domain.PermissionSchemaView)))
		{
			schemas.POST("", middleware.RequirePermission(string(domain.PermissionSchemaEdit)), schemaHandler.CreateSchema)
			schemas.GET("", schemaHandler.ListSchemas)
			schemas.GET("/predefined", schemaHandler.GetPredefinedSchemas)
			schemas.GET("/:id", schemaHandler.GetSchema)
			schemas.PUT("/:id", middleware.RequirePermission(string(domain.PermissionSchemaEdit)), schemaHandler.UpdateSchema)
			schemas.DELETE("/:id", middleware.RequirePermission(string(domain.PermissionSchemaDelete)), schemaHandler.DeleteSchema)
		}

		// Node Types (with permissions)
		nodeTypes := api.Group("/node-types")
		nodeTypes.Use(middleware.RequirePermission(string(domain.PermissionNodeTypeView)))
		{
			nodeTypes.GET("", nodeTypeHandler.ListNodeTypes)
			nodeTypes.GET("/built-in", nodeTypeHandler.GetBuiltInNodeTypes)
			nodeTypes.POST("", middleware.RequirePermission(string(domain.PermissionNodeTypeEdit)), nodeTypeHandler.CreateCustomNodeType)
		}

		// Mappings (with permissions)
		mappings := api.Group("/mappings")
		mappings.Use(middleware.RequirePermission(string(domain.PermissionMappingView)))
		{
			mappings.POST("/suggest", mappingHandler.SuggestMapping)
			mappings.POST("", middleware.RequirePermission(string(domain.PermissionMappingEdit)), mappingHandler.SaveMapping)
			mappings.GET("", mappingHandler.ListMappings)
			mappings.GET("/:id", mappingHandler.GetMapping)
			mappings.PUT("/:id", middleware.RequirePermission(string(domain.PermissionMappingEdit)), mappingHandler.UpdateMapping)
			mappings.DELETE("/:id", middleware.RequirePermission(string(domain.PermissionMappingDelete)), mappingHandler.DeleteMapping)
		}

		// Executions (with permissions)
		executions := api.Group("/executions")
		executions.Use(middleware.RequirePermission(string(domain.PermissionExecutionView)))
		{
			executions.GET("/:id", executionHandler.GetExecution)
		}

		// Auto-save endpoint (lightweight partial update) - MUST be before /nodes routes
		workflows.POST("/:id/autosave", middleware.RequirePermission(string(domain.PermissionWorkflowEdit)), workflowHandler.PatchWorkflow)

		// Node Schemas - use :id for workflow to match existing pattern
		workflows.GET("/:id/nodes/schemas", nodeSchemaHandler.ListNodeSchemas)
		workflows.GET("/:id/nodes/:nodeId/schema", nodeSchemaHandler.GetNodeSchema)
		workflows.PUT("/:id/nodes/:nodeId/schema", middleware.RequirePermission(string(domain.PermissionWorkflowEdit)), nodeSchemaHandler.SaveNodeSchema)
		workflows.DELETE("/:id/nodes/:nodeId/schema", middleware.RequirePermission(string(domain.PermissionWorkflowEdit)), nodeSchemaHandler.DeleteNodeSchema)
		workflows.DELETE("/:id/nodes/:nodeId/schema/source", middleware.RequirePermission(string(domain.PermissionWorkflowEdit)), nodeSchemaHandler.ClearSourceSchema)
		workflows.DELETE("/:id/nodes/:nodeId/schema/target", middleware.RequirePermission(string(domain.PermissionWorkflowEdit)), nodeSchemaHandler.ClearTargetSchema)

		// AI endpoints
		aiGroup := api.Group("/ai")
		{
			aiGroup.GET("/status", aiHandler.GetStatus)
			aiGroup.POST("/generate-test-data", aiHandler.GenerateTestData)
		}

		// Versions (with permissions)
		versions := api.Group("/versions")
		versions.Use(middleware.RequirePermission(string(domain.PermissionVersionView)))
		{
			versions.GET("", versionHandler.ListVersions)
			versions.GET("/:id", versionHandler.GetVersion)
			versions.POST("", middleware.RequirePermission(string(domain.PermissionVersionEdit)), versionHandler.CreateVersion)
			versions.PUT("/:id", middleware.RequirePermission(string(domain.PermissionVersionEdit)), versionHandler.UpdateVersion)
			versions.DELETE("/:id", middleware.RequirePermission(string(domain.PermissionVersionDelete)), versionHandler.DeleteVersion)
			versions.POST("/:id/set-default", middleware.RequirePermission(string(domain.PermissionVersionEdit)), versionHandler.SetDefaultVersion)
		}

		// Projects (with permissions) - replaces versions as main container
		projects := api.Group("/projects")
		projects.Use(middleware.RequirePermission(string(domain.PermissionVersionView)))
		{
			projects.GET("", projectHandler.List)
			projects.GET("/:id", projectHandler.Get)
			projects.POST("", middleware.RequirePermission(string(domain.PermissionVersionEdit)), projectHandler.Create)
			projects.PUT("/:id", middleware.RequirePermission(string(domain.PermissionVersionEdit)), projectHandler.Update)
			projects.DELETE("/:id", middleware.RequirePermission(string(domain.PermissionVersionDelete)), projectHandler.Delete)
			projects.POST("/:id/lock", middleware.RequirePermission(string(domain.PermissionProjectLock)), projectHandler.ToggleLock)
			// Workflows within project
			projects.POST("/:id/workflows", middleware.RequirePermission(string(domain.PermissionWorkflowEdit)), projectHandler.AddWorkflow)
			projects.GET("/:id/workflows/:workflowId", projectHandler.GetWorkflow)
			projects.PUT("/:id/workflows/:workflowId", middleware.RequirePermission(string(domain.PermissionWorkflowEdit)), projectHandler.UpdateWorkflow)
			projects.DELETE("/:id/workflows/:workflowId", middleware.RequirePermission(string(domain.PermissionWorkflowDelete)), projectHandler.DeleteWorkflow)
			// Executions for project
			projects.GET("/:id/executions", middleware.RequirePermission(string(domain.PermissionExecutionView)), executionHandler.ListExecutionsByProject)
		}
	}

	// Webhook endpoints (dynamic)
	r.Any("/webhook/*path", webhookHandler.HandleWebhook)
	// Versioned API endpoints: /api/{version}/{custom-path}
	r.Any("/api/:version/*path", webhookHandler.HandleVersionedWebhook)

	// Start server
	srv := &http.Server{
		Addr:    ":" + cfg.Server.Port,
		Handler: r,
	}

	go func() {
		logger.Log.Infow("Server starting", "port", cfg.Server.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Log.Fatalw("Failed to start server", "error", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Log.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Log.Fatalw("Server forced to shutdown", "error", err)
	}

	logger.Log.Info("Server exited")
}
