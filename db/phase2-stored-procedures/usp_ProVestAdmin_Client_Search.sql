CREATE OR ALTER PROCEDURE [dbo].[usp_ProVestAdmin_Client_Search]
    @Search         NVARCHAR(200) = NULL,
    @IsActive       BIT           = NULL,
    @IsMergingEnabled BIT         = NULL,
    @IsZipExtractionEnabled BIT   = NULL,
    @ProjectSetupId INT           = NULL,
    @SortBy         VARCHAR(50)   = 'ClientName',
    @SortDir        VARCHAR(4)    = 'ASC',
    @Page           INT           = 1,
    @PageSize       INT           = 50
AS
BEGIN
    SET NOCOUNT ON;

    -- The SP is the last line of defence, not the API.
    IF @Page < 1 SET @Page = 1;
    IF @PageSize IS NULL OR @PageSize < 1 SET @PageSize = 50;
    IF @PageSize > 100 SET @PageSize = 100;
    IF @SortDir NOT IN ('ASC','DESC') SET @SortDir = 'ASC';
    IF @SortBy NOT IN ('Id','ClientName','ClientCode','IsActive') SET @SortBy = 'ClientName';

    -- LIKE metacharacters neutralised here so the API never has to.
    DECLARE @Term NVARCHAR(210) = NULL;
    IF @Search IS NOT NULL AND LTRIM(RTRIM(@Search)) <> ''
        SET @Term = '%' + REPLACE(REPLACE(REPLACE(@Search,'\','\\'),'%','\%'),'_','\_') + '%';

    -- InboundFolder / OutboundFolder are varchar(max) and deliberately absent here;
    -- they come from _GetById.
    SELECT
        c.Id,
        c.ClientName,
        c.ClientCode,
        c.IsMergingEnabled,
        c.IsActive,
        c.StateColumn,
        c.UniqueColumns,
        c.IsZipExtractionEnabled,
        c.FileNumberColumn,
        c.ProjectSetupId,
        COUNT(*) OVER () AS TotalCount
    FROM dbo.ProVestClient c
    WHERE (@IsActive               IS NULL OR c.IsActive = @IsActive)
      AND (@IsMergingEnabled       IS NULL OR ISNULL(c.IsMergingEnabled, 0) = @IsMergingEnabled)
      AND (@IsZipExtractionEnabled IS NULL OR ISNULL(c.IsZipExtractionEnabled, 0) = @IsZipExtractionEnabled)
      AND (@ProjectSetupId         IS NULL OR c.ProjectSetupId = @ProjectSetupId)
      AND (@Term IS NULL OR
              c.ClientName       LIKE @Term ESCAPE '\'
           OR c.ClientCode       LIKE @Term ESCAPE '\'
           OR c.StateColumn      LIKE @Term ESCAPE '\'
           OR c.UniqueColumns    LIKE @Term ESCAPE '\'
           OR c.FileNumberColumn LIKE @Term ESCAPE '\')
    ORDER BY
        CASE WHEN @SortDir='ASC'  AND @SortBy='ClientName' THEN c.ClientName END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='ClientName' THEN c.ClientName END DESC,
        CASE WHEN @SortDir='ASC'  AND @SortBy='ClientCode' THEN c.ClientCode END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='ClientCode' THEN c.ClientCode END DESC,
        CASE WHEN @SortDir='ASC'  AND @SortBy='IsActive'   THEN c.IsActive   END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='IsActive'   THEN c.IsActive   END DESC,
        CASE WHEN @SortDir='DESC' AND @SortBy='Id'         THEN c.Id         END DESC,
        c.Id ASC                                  -- default + deterministic tiebreaker
    OFFSET (@Page - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY
    OPTION (RECOMPILE);
END
